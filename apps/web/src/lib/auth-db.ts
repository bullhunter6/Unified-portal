import { esgPrisma } from "@esgcredit/db-esg";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";

// Returns the raw users row (whatever columns exists)
export async function findUserByEmail(email: string) {
  const rows = await esgPrisma.$queryRaw<any[]>`
    SELECT * FROM users
    WHERE lower(email) = lower(${email})
    LIMIT 1;
  `;
  return rows[0] ?? null;
}

// Get the authenticated user ID from the session
export async function ensureUserId(): Promise<number | null> {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return null;
  }
  
  // The session includes user.id due to our callback configuration
  const userWithId = session.user as any;
  
  if (!userWithId.id) {
    return null;
  }
  
  // Convert string ID from session to number
  const userId = parseInt(userWithId.id, 10);
  
  if (isNaN(userId)) {
    return null;
  }
  
  // Check if user exists in database, if not create them
  try {
    const existingUser = await esgPrisma.users.findUnique({
      where: { id: userId }
    });
    
    if (!existingUser) {
      // Create user if they don't exist
      const newUser = await esgPrisma.users.create({
        data: {
          id: userId,
          username: session.user.email?.split('@')[0] || `user_${userId}`,
          email: session.user.email || null,
          password_hash: '', // Empty since they're using NextAuth
          first_name: session.user.name?.split(' ')[0] || null,
          last_name: session.user.name?.split(' ').slice(1).join(' ') || null,
          is_admin: false,
          is_active_db: true,
        }
      });
      console.log('Created new user:', newUser.id);
    }
    
    return userId;
  } catch (error) {
    console.error('Error ensuring user exists:', error);
    return null;
  }
}
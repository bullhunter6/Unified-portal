// Date formatting utilities for consistent display
export function fmtDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return null;
    
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return null;
  }
}

export function fmtDateRange(startDate: Date | string | null | undefined, endDate?: Date | string | null | undefined): string | null {
  const start = startDate ? (startDate instanceof Date ? startDate : new Date(startDate)) : null;
  const end = endDate ? (endDate instanceof Date ? endDate : new Date(endDate)) : null;
  
  if (!start && !end) return null;
  if (start && !end) return fmtDate(start);
  if (!start && end) return fmtDate(end);
  
  if (!start || !end) return null;
  
  // Check if dates are invalid
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  
  // Same day
  if (start.toDateString() === end.toDateString()) {
    return fmtDate(start);
  }
  
  // Same month and year
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.toLocaleDateString('en-US', { month: "short", day: "numeric" })}–${end.getDate()}, ${end.getFullYear()}`;
  }
  
  // Different months/years
  return `${fmtDate(start)} → ${fmtDate(end)}`;
}

export function fmtTime(time: string | null | undefined): string | null {
  if (!time) return null;
  
  try {
    // If time is already formatted (e.g., "2:00 PM"), return as-is
    if (time.includes('AM') || time.includes('PM')) return time;
    
    // If time is in HH:MM format, convert to 12-hour format
    const [hours, minutes] = time.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return time; // Return original if parsing fails
    
    const date = new Date();
    date.setHours(hours, minutes);
    
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return time; // Return original string if conversion fails
  }
}

export function fmtDateTime(date: Date | string | null | undefined, time?: string | null, timezone?: string | null): string | null {
  const dateStr = fmtDate(date);
  if (!dateStr) return null;
  
  const timeStr = fmtTime(time);
  if (!timeStr) return dateStr;
  
  return `${dateStr} at ${timeStr}${timezone ? ` (${timezone})` : ''}`;
}

export function getRelativeTimeStatus(startDate: Date | string | null | undefined, endDate?: Date | string | null | undefined) {
  const start = startDate ? (startDate instanceof Date ? startDate : new Date(startDate)) : null;
  const end = endDate ? (endDate instanceof Date ? endDate : new Date(endDate)) : null;
  
  if (!start && !end) return null;
  
  const now = new Date();
  
  // If we have a start date and it's in the future
  if (start && start > now) {
    const days = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 1) return { status: 'upcoming', label: 'Tomorrow' };
    if (days <= 7) return { status: 'upcoming', label: `In ${days} days` };
    return { status: 'future', label: 'Upcoming' };
  }
  
  // If we have an end date and it's in the past
  if (end && end < now) return { status: 'past', label: 'Past' };
  
  // If event is currently ongoing (started but not ended)
  if (start && start <= now && (!end || end >= now)) {
    return { status: 'ongoing', label: 'Live' };
  }
  
  return { status: 'future', label: 'Upcoming' };
}
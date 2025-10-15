import { PDFDocument } from "pdf-lib";
import { createWorker } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";

// Configure PDF.js for Node.js environment
if (typeof globalThis.btoa === "undefined") {
  globalThis.btoa = (str: string) => Buffer.from(str, "binary").toString("base64");
}
if (typeof globalThis.atob === "undefined") {
  globalThis.atob = (str: string) => Buffer.from(str, "base64").toString("binary");
}

/**
 * Extract text from PDF buffer
 * This is a server-side safe implementation that works with both text and image PDFs
 */
export async function extractPdfText(buffer: Buffer): Promise<string[]> {
  const perPage: string[] = [];
  
  try {
    // First try to extract text directly from PDF
    const doc = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      standardFontDataUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/",
    }).promise;

    const totalPages = doc.numPages;
    console.log(`PDF has ${totalPages} pages`);

    for (let i = 1; i <= totalPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(" ")
        .trim();

      // Strategy: Always try OCR for comprehensive extraction
      // Then combine with any extracted text for best results
      console.log(`Page ${i}: Extracted ${pageText.length} chars of direct text, running OCR...`);
      const ocrText = await extractPageWithOCR(page);
      
      // Combine both sources: direct text + OCR
      let combinedText = "";
      
      if (pageText.length > 0 && ocrText.length > 0) {
        // Both exist - combine them intelligently
        // If OCR contains the direct text, use OCR only (avoid duplication)
        if (ocrText.toLowerCase().includes(pageText.toLowerCase().substring(0, Math.min(50, pageText.length)))) {
          combinedText = ocrText;
          console.log(`Page ${i}: Using OCR text (${ocrText.length} chars) as it includes direct text`);
        } else {
          // Different content - combine both
          combinedText = pageText + "\n\n" + ocrText;
          console.log(`Page ${i}: Combined direct text + OCR (${combinedText.length} chars total)`);
        }
      } else if (ocrText.length > 0) {
        combinedText = ocrText;
        console.log(`Page ${i}: Using OCR text only (${ocrText.length} chars)`);
      } else if (pageText.length > 0) {
        combinedText = pageText;
        console.log(`Page ${i}: Using direct text only (${pageText.length} chars)`);
      } else {
        combinedText = `[Page ${i} - No text detected]`;
        console.log(`Page ${i}: No text found`);
      }
      
      perPage.push(combinedText);
    }

    return perPage;
  } catch (error) {
    console.error("Error extracting PDF text:", error);
    // Fallback: try pure OCR approach
    console.log("Falling back to OCR-only extraction");
    return await extractPdfTextWithOCR(buffer);
  }
}

/**
 * Generate realistic sample content for demonstration
 * In production, this would be replaced with actual PDF text extraction
 */
function generateSampleContent(pageNum: number, totalPages: number): string {
  const sampleTexts = [
    `Executive Summary

This document provides a comprehensive analysis of environmental, social, and governance (ESG) factors affecting modern business operations. Our research indicates that companies implementing robust ESG frameworks demonstrate superior long-term performance metrics.

Key findings include:
• 73% improvement in stakeholder trust
• 45% reduction in operational risks
• 28% increase in employee retention
• 52% better regulatory compliance scores

The transition to sustainable business practices requires strategic planning, stakeholder engagement, and continuous monitoring of performance indicators.`,

    `Environmental Impact Assessment

Climate change represents one of the most significant challenges facing global business today. Organizations must adapt their operations to minimize environmental impact while maintaining competitive advantage.

Carbon Emission Reduction Strategies:
1. Renewable energy adoption
2. Supply chain optimization
3. Waste reduction programs
4. Energy efficiency improvements
5. Sustainable transportation solutions

Our analysis shows that companies investing in environmental initiatives see average cost savings of 15-30% within the first three years of implementation.`,

    `Social Responsibility Framework

Corporate social responsibility extends beyond charitable contributions to encompass fair labor practices, community engagement, and ethical business conduct. Modern consumers and investors increasingly prioritize companies demonstrating genuine social impact.

Core Social Initiatives:
- Diversity and inclusion programs
- Fair wage policies
- Community development projects
- Educational partnerships
- Health and safety improvements

Research indicates that socially responsible companies experience 20% higher employee satisfaction and 35% better brand perception among consumers.`,

    `Governance and Risk Management

Effective governance structures ensure transparency, accountability, and ethical decision-making throughout the organization. Strong governance frameworks protect stakeholder interests and support sustainable growth.

Governance Best Practices:
• Independent board oversight
• Regular risk assessments
• Transparent reporting mechanisms
• Stakeholder engagement protocols
• Ethical conduct policies

Companies with robust governance frameworks typically achieve 25% lower compliance costs and 40% fewer regulatory issues compared to industry averages.`,

    `Implementation Roadmap

Successful ESG integration requires a systematic approach with clear milestones, measurable objectives, and regular performance reviews. Organizations should develop comprehensive implementation plans addressing all aspects of their operations.

Phase 1: Assessment and Planning (Months 1-3)
- Current state analysis
- Stakeholder mapping
- Goal setting and target definition
- Resource allocation

Phase 2: Implementation (Months 4-12)
- Policy development and deployment
- Training and capacity building
- System integration
- Performance monitoring setup

Phase 3: Optimization (Months 13-24)
- Performance review and adjustment
- Stakeholder feedback integration
- Continuous improvement processes
- Expansion of successful initiatives

Organizations following this structured approach report 60% higher success rates in achieving their ESG objectives.`
  ];

  // Select appropriate content based on page number
  const baseContent = sampleTexts[(pageNum - 1) % sampleTexts.length];
  
  return `Page ${pageNum} of ${totalPages}

${baseContent}

---

Note: This content represents extracted text from your uploaded PDF document. The actual translation will preserve the original structure, formatting, and context while converting it to your selected target language.`;
}

/**
 * Extract text from a single PDF page using OCR
 */
async function extractPageWithOCR(page: any): Promise<string> {
  try {
    const viewport = page.getViewport({ scale: 2.0 });
    const { createCanvas } = await import("canvas");
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    const imageBuffer = canvas.toBuffer("image/png");
    
    // Use Tesseract OCR
    const worker = await createWorker("eng");
    const { data: { text } } = await worker.recognize(imageBuffer);
    await worker.terminate();

    return text.trim();
  } catch (error) {
    console.error("OCR extraction failed:", error);
    return "";
  }
}

/**
 * Alternative OCR-based text extraction (for image-heavy PDFs)
 * This function would be used when standard PDF text extraction fails
 */
export async function extractPdfTextWithOCR(buffer: Buffer): Promise<string[]> {
  const perPage: string[] = [];
  
  try {
    const doc = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    }).promise;

    const totalPages = doc.numPages;
    console.log(`OCR-only mode: Processing ${totalPages} pages`);

    for (let i = 1; i <= totalPages; i++) {
      const page = await doc.getPage(i);
      const ocrText = await extractPageWithOCR(page);
      perPage.push(ocrText || `[Page ${i} - No text detected]`);
      console.log(`OCR Page ${i}/${totalPages}: Extracted ${ocrText.length} chars`);
    }

    return perPage;
  } catch (error) {
    console.error("Complete OCR extraction failed:", error);
    return ["Error: Unable to process PDF with OCR. Please ensure Tesseract is installed."];
  }
}
export const IMAGE_UPLOAD_CONFIG = {
  // Ticket uploads → bucket: ticket-uploads
  ticket: {
    maxFileSize: 10 * 1024 * 1024, // 10MB per file
    maxFilesPerUpload: 3,
    maxTotalSize: 10 * 1024 * 1024,
  },

  // Payment proof uploads → bucket: payment-proofs
  payment: {
    maxFileSize: 10 * 1024 * 1024,
    maxFilesPerUpload: 1,
    maxTotalSize: 10 * 1024 * 1024,
  },

  // Quote request attachments → bucket: quote-attachments
  quote: {
    maxFileSize: 10 * 1024 * 1024,
    maxFilesPerUpload: 3,
    maxTotalSize: 10 * 1024 * 1024,
  },

  // Order image uploads → bucket: order-uploads
  order: {
    maxFileSize: 10 * 1024 * 1024,
    maxFilesPerUpload: 3,
    maxTotalSize: 10 * 1024 * 1024,
  },

  // Supported file types (static images + PDFs)
  allowedTypes: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic', // iOS default
    'image/heif', // iOS/some Android
    'image/avif', // Future-proofing
    'application/pdf', // PDF support
  ],

  // File types that need conversion
  conversionRequired: ['image/heic', 'image/heif'],
};

export type ImageUploadConfig = typeof IMAGE_UPLOAD_CONFIG;

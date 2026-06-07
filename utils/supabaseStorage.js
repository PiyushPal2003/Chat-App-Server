/**
 * Supabase Storage Utility
 * 
 * This module handles all file uploads to Supabase Storage.
 * It replaces the previous Firebase Storage implementation.
 * 
 * WHY SUPABASE?
 * - Simpler API compared to Firebase
 * - Better pricing for storage
 * - Integrated with Supabase ecosystem (if you use their DB later)
 * - Easy public URL generation
 * 
 * BUCKET STRUCTURE:
 * ChatApp/
 *   ├── profiles/          # User profile photos
 *   ├── groups/            # Group chat photos
 *   └── chat-files/        # Message attachments
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize Supabase client with service role key (for server-side operations)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BUCKET_NAME = 'ChatApp';

/**
 * Upload a file to Supabase Storage
 * 
 * @param {Object} file - Multer file object with path, mimetype, originalname
 * @param {string} folder - Folder inside bucket (profiles, groups, chat-files)
 * @param {string} customName - Custom filename (optional)
 * @returns {Promise<string>} - Public URL of uploaded file
 * 
 * CONCEPT: Unlike Firebase where you upload from local path directly,
 * Supabase needs the file content (buffer). We read the file, upload,
 * then delete the temp file.
 */
async function uploadFile(file, folder, customName = null) {
  // Read file into buffer
  const fileBuffer = fs.readFileSync(file.path);
  
  // Generate unique filename
  const timestamp = Date.now();
  const originalName = file.originalname || path.basename(file.path);
  const fileName = customName || `${timestamp}_${originalName}`;
  
  // Full path in bucket: folder/filename
  const filePath = `${folder}/${fileName}`;

  // Upload to Supabase
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, fileBuffer, {
      contentType: file.mimetype,
      upsert: false  // Don't overwrite if exists
    });

  // Delete temp file from Multer's disk storage.
  fs.unlinkSync(file.path);

  if (error) {
    console.error('Supabase upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  // Generate public URL
  // Format: https://PROJECT_ID.supabase.co/storage/v1/object/public/BUCKET/PATH
  const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${filePath}`;
  
  return publicUrl;
}

/**
 * Delete a file from Supabase Storage
 * 
 * @param {string} fileUrl - Full public URL of the file
 * @returns {Promise<boolean>} - True if deleted successfully
 * 
 * CONCEPT: We extract the file path from the URL and delete by path.
 * This is used when updating profile photos - delete old before uploading new.
 */
async function deleteFile(fileUrl) {
  if (!fileUrl || !fileUrl.includes('supabase.co')) {
    return false; // Not a Supabase URL, skip
  }

  // Extract path from URL
  // URL: https://xxx.supabase.co/storage/v1/object/public/ChatApp/profiles/file.jpg
  // Path: profiles/file.jpg
  const urlParts = fileUrl.split(`/storage/v1/object/public/${BUCKET_NAME}/`);
  if (urlParts.length < 2) {
    return false;
  }
  
  const filePath = urlParts[1];

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([filePath]);

  if (error) {
    console.error('Supabase delete error:', error);
    return false;
  }

  return true;
}

/**
 * Upload multiple files (for chat attachments)
 * 
 * @param {Array} files - Array of Multer file objects
 * @param {string} folder - Folder inside bucket
 * @param {string} prefix - Prefix for filenames (e.g., "userId_chatId")
 * @returns {Promise<string[]>} - Array of public URLs
 */
async function uploadMultipleFiles(files, folder, prefix = '') {
  const urls = [];
  
  for (const file of files) {
    const customName = `${prefix}_${Date.now()}_${file.originalname}`;
    const url = await uploadFile(file, folder, customName);
    urls.push(url);
  }
  
  return urls;
}

module.exports = {
  uploadFile,
  deleteFile,
  uploadMultipleFiles,
  supabase,
  BUCKET_NAME
};

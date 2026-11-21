package com.rupiksha.backend.service;

import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;

public interface ProofStorageService {

    record StoredProof(
            String storagePath,
            String originalFilename,
            String contentType,
            long fileSize
    ) {}

    /**
     * Validates magic bytes, decodes, strips EXIF, sanitizes, compresses and stores image.
     */
    StoredProof storeProof(MultipartFile file) throws IOException;

    /**
     * Safely loads raw proof image bytes for authorized preview.
     */
    byte[] loadProof(String storagePath) throws IOException;

    /**
     * Deletes stored proof file if needed.
     */
    boolean deleteProof(String storagePath);
}

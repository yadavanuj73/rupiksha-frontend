package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.service.ProofStorageService;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.util.Arrays;
import java.util.UUID;

@Slf4j
@Service
public class LocalPrivateProofStorageService implements ProofStorageService {

    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    private static final int MAX_WIDTH = 3840;
    private static final int MAX_HEIGHT = 2160;

    // Magic Bytes
    private static final byte[] JPEG_MAGIC = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] PNG_MAGIC = new byte[]{(byte) 0x89, (byte) 0x50, (byte) 0x4E, (byte) 0x47, (byte) 0x0D, (byte) 0x0A, (byte) 0x1A, (byte) 0x0A};
    private static final byte[] RIFF_MAGIC = new byte[]{(byte) 0x52, (byte) 0x49, (byte) 0x46, (byte) 0x46}; // "RIFF"
    private static final byte[] WEBP_MAGIC = new byte[]{(byte) 0x57, (byte) 0x45, (byte) 0x42, (byte) 0x50}; // "WEBP"

    private Path storageRoot;

    public LocalPrivateProofStorageService(
            @Value("${app.storage.proof-dir:${PROOF_STORAGE_PATH:uploads/proofs}}") String storageDirPath) {
        this.storageRoot = Paths.get(storageDirPath).toAbsolutePath().normalize();
    }

    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(storageRoot);
            log.info("Initialized secure private proof storage directory: {}", storageRoot);
        } catch (Exception e) {
            log.warn("Failed to create proof storage directory at {}: {}. Falling back to system temp directory.", storageRoot, e.getMessage());
            try {
                this.storageRoot = Paths.get(System.getProperty("java.io.tmpdir"), "rupiksha-proofs").toAbsolutePath().normalize();
                Files.createDirectories(this.storageRoot);
                log.info("Initialized fallback proof storage directory: {}", this.storageRoot);
            } catch (Exception ex) {
                log.error("Failed to initialize fallback proof storage directory at {}", this.storageRoot, ex);
            }
        }
    }

    @Override
    public StoredProof storeProof(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Transaction proof file is required");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("File size exceeds 5MB limit");
        }

        byte[] fileBytes = file.getBytes();
        if (fileBytes.length < 12) {
            throw new IllegalArgumentException("Invalid file: insufficient header bytes");
        }

        // 1. Magic bytes validation
        String detectedFormat = detectRasterFormat(fileBytes);
        if (detectedFormat == null) {
            throw new IllegalArgumentException("Invalid file format. Only JPEG, PNG, and WebP raster images are permitted");
        }

        // 2. Decode via ImageIO to verify raster integrity and discard EXIF/embedded scripts
        BufferedImage sourceImage;
        try (InputStream is = new ByteArrayInputStream(fileBytes)) {
            sourceImage = ImageIO.read(is);
        }

        if (sourceImage == null) {
            throw new IllegalArgumentException("Uploaded image is corrupted or not a readable raster image");
        }

        int origWidth = sourceImage.getWidth();
        int origHeight = sourceImage.getHeight();

        // 3. Scale down if exceeding maximum bounds
        int targetWidth = origWidth;
        int targetHeight = origHeight;
        if (origWidth > MAX_WIDTH || origHeight > MAX_HEIGHT) {
            double ratio = Math.min((double) MAX_WIDTH / origWidth, (double) MAX_HEIGHT / origHeight);
            targetWidth = (int) Math.round(origWidth * ratio);
            targetHeight = (int) Math.round(origHeight * ratio);
        }

        int imageType = "PNG".equalsIgnoreCase(detectedFormat) ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB;
        BufferedImage sanitizedImage = new BufferedImage(targetWidth, targetHeight, imageType);

        Graphics2D g2d = sanitizedImage.createGraphics();
        try {
            g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2d.drawImage(sourceImage, 0, 0, targetWidth, targetHeight, null);
        } finally {
            g2d.dispose();
        }

        // 4. Re-encode to clean output stream
        String writeFormat = "PNG".equalsIgnoreCase(detectedFormat) ? "png" : "jpg";
        String contentType = "PNG".equalsIgnoreCase(detectedFormat) ? "image/png" : "image/jpeg";
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        boolean written = ImageIO.write(sanitizedImage, writeFormat, baos);
        if (!written) {
            // Fallback to jpeg
            writeFormat = "jpg";
            contentType = "image/jpeg";
            BufferedImage rgbFallback = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = rgbFallback.createGraphics();
            g.drawImage(sanitizedImage, 0, 0, null);
            g.dispose();
            ImageIO.write(rgbFallback, "jpg", baos);
        }

        byte[] cleanBytes = baos.toByteArray();

        // 5. Generate secure random filename
        String safeFilename = "proof_" + UUID.randomUUID().toString().replace("-", "") + "." + writeFormat;
        Path targetPath = storageRoot.resolve(safeFilename).normalize();

        // Path traversal guard
        if (!targetPath.startsWith(storageRoot)) {
            throw new SecurityException("Illegal file storage path traversal attempt");
        }

        Files.write(targetPath, cleanBytes, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

        String originalName = sanitizeOriginalFilename(file.getOriginalFilename());
        log.info("Stored sanitized transaction proof: {} ({} bytes, target: {})", safeFilename, cleanBytes.length, targetPath);

        return new StoredProof(
                safeFilename,
                originalName,
                contentType,
                cleanBytes.length
        );
    }

    @Override
    public byte[] loadProof(String storagePath) throws IOException {
        if (storagePath == null || storagePath.isBlank()) {
            throw new IllegalArgumentException("Storage path cannot be blank");
        }

        Path filePath = storageRoot.resolve(storagePath).normalize();
        if (!filePath.startsWith(storageRoot)) {
            throw new SecurityException("Illegal file access attempt outside storage boundary");
        }

        if (!Files.exists(filePath) || !Files.isRegularFile(filePath)) {
            throw new NoSuchFileException("Proof image not found on disk");
        }

        return Files.readAllBytes(filePath);
    }

    @Override
    public boolean deleteProof(String storagePath) {
        if (storagePath == null || storagePath.isBlank()) {
            return false;
        }
        try {
            Path filePath = storageRoot.resolve(storagePath).normalize();
            if (filePath.startsWith(storageRoot)) {
                return Files.deleteIfExists(filePath);
            }
        } catch (Exception e) {
            log.warn("Failed to delete proof file: {}", storagePath, e);
        }
        return false;
    }

    private String detectRasterFormat(byte[] bytes) {
        if (bytes.length >= 3 && bytes[0] == JPEG_MAGIC[0] && bytes[1] == JPEG_MAGIC[1] && bytes[2] == JPEG_MAGIC[2]) {
            return "JPEG";
        }
        if (bytes.length >= 8 && matchesPrefix(bytes, PNG_MAGIC)) {
            return "PNG";
        }
        if (bytes.length >= 12 && matchesPrefix(bytes, RIFF_MAGIC)) {
            byte[] sub = Arrays.copyOfRange(bytes, 8, 12);
            if (Arrays.equals(sub, WEBP_MAGIC)) {
                return "WEBP";
            }
        }
        return null;
    }

    private boolean matchesPrefix(byte[] data, byte[] prefix) {
        if (data.length < prefix.length) return false;
        for (int i = 0; i < prefix.length; i++) {
            if (data[i] != prefix[i]) return false;
        }
        return true;
    }

    private String sanitizeOriginalFilename(String name) {
        if (name == null || name.isBlank()) return "proof.jpg";
        String clean = Paths.get(name).getFileName().toString();
        return clean.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}

package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.service.ProofStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class LocalPrivateProofStorageServiceTest {

    private LocalPrivateProofStorageService storageService;

    @BeforeEach
    void setUp(@TempDir Path tempDir) {
        storageService = new LocalPrivateProofStorageService(tempDir.toString());
        storageService.init();
    }

    private byte[] createSampleRasterImage(String format, int width, int height) throws IOException {
        BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.BLUE);
        g.fillRect(0, 0, width, height);
        g.dispose();

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(img, format, baos);
        return baos.toByteArray();
    }

    @Test
    void storeProof_ValidJpeg_StoresSanitizedImage() throws Exception {
        byte[] jpegBytes = createSampleRasterImage("jpg", 200, 200);
        MockMultipartFile file = new MockMultipartFile("proof", "transaction_receipt.jpg", "image/jpeg", jpegBytes);

        ProofStorageService.StoredProof stored = storageService.storeProof(file);

        assertNotNull(stored);
        assertTrue(stored.storagePath().startsWith("proof_"));
        assertTrue(stored.storagePath().endsWith(".jpg"));
        assertEquals("image/jpeg", stored.contentType());

        byte[] loaded = storageService.loadProof(stored.storagePath());
        assertNotNull(loaded);
        assertTrue(loaded.length > 0);
    }

    @Test
    void storeProof_ValidPng_StoresSanitizedImage() throws Exception {
        byte[] pngBytes = createSampleRasterImage("png", 150, 150);
        MockMultipartFile file = new MockMultipartFile("proof", "slip.png", "image/png", pngBytes);

        ProofStorageService.StoredProof stored = storageService.storeProof(file);

        assertNotNull(stored);
        assertTrue(stored.storagePath().startsWith("proof_"));
        assertTrue(stored.storagePath().endsWith(".png"));

        byte[] loaded = storageService.loadProof(stored.storagePath());
        assertNotNull(loaded);
    }

    @Test
    void storeProof_InvalidFormat_ThrowsException() {
        byte[] fakeSvg = "<svg><script>alert('xss')</script></svg>".getBytes();
        MockMultipartFile file = new MockMultipartFile("proof", "evil.png", "image/png", fakeSvg);

        assertThrows(IllegalArgumentException.class, () -> storageService.storeProof(file));
    }

    @Test
    void storeProof_EmptyFile_ThrowsException() {
        MockMultipartFile file = new MockMultipartFile("proof", "empty.jpg", "image/jpeg", new byte[0]);
        assertThrows(IllegalArgumentException.class, () -> storageService.storeProof(file));
    }

    @Test
    void loadProof_PathTraversalAttempt_ThrowsSecurityException() {
        assertThrows(SecurityException.class, () -> storageService.loadProof("../../../etc/passwd"));
    }
}

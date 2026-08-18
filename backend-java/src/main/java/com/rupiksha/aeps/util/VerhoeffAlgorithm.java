package com.rupiksha.aeps.util;

/**
 * Verhoeff Algorithm for validating Indian Aadhaar Numbers (12-digit) 
 * and Virtual IDs (16-digit) as required by UIDAI & NPCI / Fingpay AEPS standards.
 */
public class VerhoeffAlgorithm {

    // The multiplication table
    private static final int[][] d = {
            {0, 1, 2, 3, 4, 5, 6, 7, 8, 9},
            {1, 2, 3, 4, 0, 6, 7, 8, 9, 5},
            {2, 3, 4, 0, 1, 7, 8, 9, 5, 6},
            {3, 4, 0, 1, 2, 8, 9, 5, 6, 7},
            {4, 0, 1, 2, 3, 9, 5, 6, 7, 8},
            {5, 9, 8, 7, 6, 0, 4, 3, 2, 1},
            {6, 5, 9, 8, 7, 1, 0, 4, 3, 2},
            {7, 6, 5, 9, 8, 2, 1, 0, 4, 3},
            {8, 7, 6, 5, 9, 3, 2, 1, 0, 4},
            {9, 8, 7, 6, 5, 4, 3, 2, 1, 0}
    };

    // The permutation table
    private static final int[][] p = {
            {0, 1, 2, 3, 4, 5, 6, 7, 8, 9},
            {1, 5, 7, 6, 2, 8, 3, 0, 9, 4},
            {5, 8, 0, 3, 7, 9, 6, 1, 4, 2},
            {8, 9, 1, 6, 0, 4, 3, 5, 2, 7},
            {9, 4, 5, 3, 1, 2, 6, 8, 7, 0},
            {4, 2, 8, 6, 5, 7, 3, 9, 0, 1},
            {2, 7, 9, 3, 8, 0, 6, 4, 1, 5},
            {7, 0, 4, 6, 9, 1, 3, 2, 5, 8}
    };

    /**
     * Validates that the string represents a valid Aadhaar or VID according to the Verhoeff algorithm.
     *
     * @param numStr numeric string of 12 or 16 digits
     * @return true if checksum passes, false otherwise
     */
    public static boolean validateVerhoeff(String numStr) {
        if (numStr == null || !numStr.matches("\\d+")) {
            return false;
        }
        int c = 0;
        int[] myArray = stringToReversedIntArray(numStr);
        for (int i = 0; i < myArray.length; i++) {
            c = d[c][p[i % 8][myArray[i]]];
        }
        return c == 0;
    }

    private static int[] stringToReversedIntArray(String num) {
        int[] myArray = new int[num.length()];
        for (int i = 0; i < num.length(); i++) {
            myArray[i] = Character.getNumericValue(num.charAt(num.length() - i - 1));
        }
        return myArray;
    }
}

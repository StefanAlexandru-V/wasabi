import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { encrypt, decrypt, isEncrypted } from "@/lib/encryption";

const TEST_KEY = "a".repeat(64);

describe("encryption", () => {
  beforeAll(() => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  afterAll(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  it("encrypts and decrypts a string", () => {
    const plaintext = "ghp_test_token_12345";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertexts for same input", () => {
    const plaintext = "ghp_test_token_12345";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it("detects encrypted values", () => {
    const encrypted = encrypt("test");
    expect(isEncrypted(encrypted)).toBe(true);
  });

  it("detects plaintext tokens as not encrypted", () => {
    expect(isEncrypted("ghp_abc123def456")).toBe(false);
    expect(isEncrypted("gho_short")).toBe(false);
  });

  it("throws on missing key", () => {
    const saved = process.env.TOKEN_ENCRYPTION_KEY;
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => encrypt("test")).toThrow("TOKEN_ENCRYPTION_KEY");
    process.env.TOKEN_ENCRYPTION_KEY = saved;
  });

  it("throws on invalid key length", () => {
    const saved = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = "abcd";
    expect(() => encrypt("test")).toThrow("64 hex characters");
    process.env.TOKEN_ENCRYPTION_KEY = saved;
  });
});

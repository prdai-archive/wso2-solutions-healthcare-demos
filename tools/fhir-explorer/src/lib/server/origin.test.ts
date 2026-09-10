import { afterEach, describe, expect, it } from "vitest";
import { applicationOrigin, isAllowedOrigin } from "./origin";

const originalAllowedOrigins = process.env.EXPLORER_ALLOWED_ORIGINS;

afterEach(() => {
  if (originalAllowedOrigins === undefined) delete process.env.EXPLORER_ALLOWED_ORIGINS;
  else process.env.EXPLORER_ALLOWED_ORIGINS = originalAllowedOrigins;
});

describe("isAllowedOrigin", () => {
  it("allows requests without an Origin header", () => {
    expect(isAllowedOrigin(null, "https://explorer.example.com")).toBe(true);
  });

  it("allows only the application origin by default", () => {
    expect(isAllowedOrigin("https://explorer.example.com", "https://explorer.example.com")).toBe(
      true,
    );
    expect(isAllowedOrigin("https://other.example.com", "https://explorer.example.com")).toBe(
      false,
    );
  });

  it("uses configured first-party origins", () => {
    process.env.EXPLORER_ALLOWED_ORIGINS = "https://app.example.com, https://staff.example.com/";

    expect(isAllowedOrigin("https://app.example.com", "https://explorer.example.com")).toBe(true);
    expect(isAllowedOrigin("https://staff.example.com", "https://explorer.example.com")).toBe(true);
    expect(isAllowedOrigin("https://explorer.example.com", "https://explorer.example.com")).toBe(
      false,
    );
  });
});

describe("applicationOrigin", () => {
  it("uses the forwarded public origin", () => {
    const headers = new Headers({
      Host: "explorer.internal:3000",
      "X-Forwarded-Host": "explorer.example.com",
      "X-Forwarded-Proto": "https",
    });

    expect(applicationOrigin(headers, "http://explorer.internal:3000")).toBe(
      "https://explorer.example.com",
    );
  });

  it("uses the request host when no forwarding headers are present", () => {
    expect(applicationOrigin(new Headers({ Host: "localhost:3000" }), "http://0.0.0.0:3000")).toBe(
      "http://localhost:3000",
    );
  });
});

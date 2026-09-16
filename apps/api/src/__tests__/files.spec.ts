import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb } from "../db";
import { app as rawApp } from "../app";
import { cleanupSessions, createSystemSession } from "../testing/session";
import {
  createPresignedDownload,
  createPresignedUpload,
  deleteObject,
  listObjects,
} from "../storage/s3";

vi.mock("../storage/s3", () => ({
  createPresignedDownload: vi.fn(),
  createPresignedUpload: vi.fn(),
  deleteObject: vi.fn(),
  listObjects: vi.fn(),
}));
const signer = vi.mocked(createPresignedUpload);
const downloader = vi.mocked(createPresignedDownload);
const remover = vi.mocked(deleteObject);
const lister = vi.mocked(listObjects);

let sessionCookie = "";

function routeRequest(
  path: string,
  method: string,
  body?: unknown,
  cookie = sessionCookie,
) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (cookie) headers.set("Cookie", cookie);
  return rawApp.request(path, {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  });
}

function request(body: unknown, cookie = sessionCookie) {
  return routeRequest("/files/presigned-url", "POST", body, cookie);
}

describe("file upload presign route", () => {
  beforeEach(async () => {
    signer.mockReset();
    signer.mockResolvedValue({
      url: "https://storage.test/upload",
      expiresIn: 900,
    });
    downloader.mockReset();
    downloader.mockResolvedValue({
      url: "https://storage.test/download",
      expiresIn: 900,
    });
    remover.mockReset();
    remover.mockResolvedValue(undefined);
    lister.mockReset();
    lister.mockResolvedValue({
      $metadata: {},
      CommonPrefixes: [],
      Contents: [],
    });
    sessionCookie = (await createSystemSession([], "files")).cookie;
  });

  afterEach(() => cleanupSessions());
  afterAll(() => closeDb());

  it("requires an authenticated session", async () => {
    const response = await request(
      { filename: "report.txt", contentType: "text/plain", size: 12 },
      "",
    );

    expect(response.status).toBe(401);
    expect(signer).not.toHaveBeenCalled();
  });

  it("returns a server-generated direct upload URL", async () => {
    const response = await request({
      filename: "../../secret.txt",
      contentType: "text/plain",
      size: 12,
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      data: {
        uploadUrl: "https://storage.test/upload",
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        expiresIn: 900,
        asset: {
          kind: 'file',
          name: expect.stringMatching(/\.txt$/),
          mimeType: 'text/plain',
          size: 12,
        },
      },
    });

    const call = signer.mock.calls[0]?.[0];
    expect(call?.key).toMatch(/^uploads\/[0-9a-f-]+\.txt$/);
    expect(call?.key).not.toContain("secret");
    expect(call?.contentType).toBe("text/plain");
  });

  it("rejects invalid upload metadata before signing", async () => {
    const invalidBodies: unknown[] = [
      "{not-json",
      {},
      { filename: "report.txt", contentType: "textplain", size: 12 },
      { filename: "report.txt", contentType: "text/plain", size: 0 },
      {
        filename: "report.txt",
        contentType: "text/plain",
        size: 25 * 1024 * 1024 + 1,
      },
    ];

    for (const body of invalidBodies) {
      signer.mockClear();
      const response = await request(body);
      expect(response.status).toBe(400);
      expect(signer).not.toHaveBeenCalled();
    }
  });

  it("hides signer failures behind the internal error contract", async () => {
    signer.mockRejectedValueOnce(new Error("storage secret should not leak"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await request({
        filename: "report.txt",
        contentType: "text/plain",
        size: 12,
      });

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({ error: "internal_error" });
      expect(JSON.stringify(body)).not.toContain("storage secret");
    } finally {
      log.mockRestore();
    }
  });

  it("lists objects and folders under an authenticated prefix", async () => {
    lister.mockResolvedValueOnce({
      $metadata: {},
      CommonPrefixes: [{ Prefix: "uploads/images/" }],
      Contents: [
        {
          Key: "uploads/report.txt",
          Size: 12,
          LastModified: new Date("2026-08-10T00:00:00.000Z"),
        },
      ],
    });

    const response = await routeRequest("/files?prefix=uploads/", "GET");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: [
        { id: "uploads/images/", kind: "folder", name: "images" },
        {
          id: "uploads/report.txt",
          kind: "file",
          name: "report.txt",
          mimeType: "text/plain",
          size: 12,
          url: "http://localhost/files/object?key=uploads%2Freport.txt",
        },
      ],
      meta: { total: 2, totalPage: 1 },
    });
    expect(lister).toHaveBeenCalledWith("uploads/");
  });

  it("redirects authenticated display requests to a signed GET URL", async () => {
    const response = await routeRequest(
      "/files/object?key=uploads%2Freport.txt",
      "GET",
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "https://storage.test/download",
    );
    expect(downloader).toHaveBeenCalledWith("uploads/report.txt");
  });

  it("deletes an authenticated object after validating its key", async () => {
    const response = await routeRequest("/files/object", "DELETE", {
      key: "uploads/report.txt",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(remover).toHaveBeenCalledTimes(1);
    expect(remover).toHaveBeenCalledWith("uploads/report.txt");

    for (const key of [
      "https://files.test/report.txt",
      "report.txt",
      "uploads/nested/report.txt",
      "uploads/../report.txt",
    ]) {
      const invalidDownload = await routeRequest(`/files/object?key=${encodeURIComponent(key)}`, "GET");
      expect(invalidDownload.status).toBe(400);
      const invalidDelete = await routeRequest("/files/object", "DELETE", { key });
      expect(invalidDelete.status).toBe(400);
    }
    expect(downloader).toHaveBeenCalledTimes(0);
    expect(remover).toHaveBeenCalledTimes(1);
  });
});

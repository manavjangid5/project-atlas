jest.mock("@atlas/database", () => ({
  prisma: {
    formSchema: { findFirst: jest.fn() },
    formSubmission: { create: jest.fn() },
  },
}));
jest.mock("../infrastructure/storage/r2Client", () => ({
  uploadToR2: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("./ruleService", () => ({ evaluateAllActiveRules: jest.fn().mockResolvedValue([]) }));

import { submitForm } from "./formService";
import { prisma } from "@atlas/database";
import { uploadToR2 } from "../infrastructure/storage/r2Client";

describe("submitForm — file upload handling", () => {
  beforeEach(() => jest.clearAllMocks());

  it("uploads an attached file to R2 and replaces the field value with a storage reference, not the raw file", async () => {
    (prisma.formSchema.findFirst as jest.Mock).mockResolvedValue({
      id: "form1",
      organizationId: "org1",
      fields: [{ id: "resume", label: "Resume", type: "file" }],
    });
    (prisma.formSubmission.create as jest.Mock).mockImplementation(({ data }) => Promise.resolve(data));

    const fakeFile = {
      fieldname: "resume",
      originalname: "resume.pdf",
      mimetype: "application/pdf",
      buffer: Buffer.from("fake pdf content"),
    } as Express.Multer.File;

    const result: any = await submitForm("org1", "form1", {}, "user1", [fakeFile]);

    expect(uploadToR2).toHaveBeenCalledTimes(1);
    const savedData = result.data;
    expect(savedData.resume).toMatchObject({ fileName: "resume.pdf", mimeType: "application/pdf" });
    expect(savedData.resume.storageKey).toEqual(expect.stringContaining("form-submissions"));
    expect(typeof savedData.resume).not.toBe("string"); // confirms it's not left as a raw/unhandled value
  });

  it("submits normally with no files attached (backward compatible)", async () => {
    (prisma.formSchema.findFirst as jest.Mock).mockResolvedValue({
      id: "form1",
      organizationId: "org1",
      fields: [{ id: "name", label: "Name", type: "text", required: true }],
    });
    (prisma.formSubmission.create as jest.Mock).mockResolvedValue({ id: "sub1" });

    const result = await submitForm("org1", "form1", { name: "Manav" });
    expect(uploadToR2).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});
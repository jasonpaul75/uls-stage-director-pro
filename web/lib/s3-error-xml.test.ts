import { describe, expect, it } from "vitest";

import { parseAmazonS3ErrorXml } from "./s3-error-xml";

describe("parseAmazonS3ErrorXml", () => {
  it("extracts Code and Message", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Error><Code>AccessDenied</Code><Message>User is not authorized</Message><RequestId>abc</RequestId></Error>`;
    expect(parseAmazonS3ErrorXml(xml)).toEqual({
      code: "AccessDenied",
      message: "User is not authorized",
    });
  });

  it("returns empty object for non-XML", () => {
    expect(parseAmazonS3ErrorXml("")).toEqual({});
    expect(parseAmazonS3ErrorXml("not xml")).toEqual({});
  });
});

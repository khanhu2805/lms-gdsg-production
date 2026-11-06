import { describe, expect, it } from "vitest";
import { inflateRawSync } from "node:zlib";
import { buildAnswersWord } from "@/modules/grading/answers-export";

function documentXmlFromZip(zip: Buffer) {
  let pos = 0;
  while (pos + 30 <= zip.length && zip.readUInt32LE(pos) === 0x04034b50) {
    const method = zip.readUInt16LE(pos + 8);
    const len = zip.readUInt32LE(pos + 18);
    const fileLen = zip.readUInt16LE(pos + 26);
    const extraLen = zip.readUInt16LE(pos + 28);
    const path = zip.subarray(pos + 30, pos + 30 + fileLen).toString("utf8");
    const start = pos + 30 + fileLen + extraLen;
    if (path === "word/document.xml") {
      const compressed = zip.subarray(start, start + len);
      return (method === 8 ? inflateRawSync(compressed) : compressed).toString("utf8");
    }
    pos = start + len;
  }
  throw new Error("Missing word/document.xml");
}

describe("Word export", () => {
  it("exports all attempts, selected answers, and optional teacher feedback", () => {
    const buffer = buildAnswersWord({
      title: "Kiểm tra Ngữ văn", classCode: "VAN09", maxScore: { toString: () => "10" },
      questions: [{
        id: "q1", order: 1, content: "Chọn đáp án đúng", score: { toString: () => "2" },
        choices: [
          {id:"c1",content:"Sai",order:1},{id:"c2",content:"Đúng",order:2},
        ],
      }],
      attempts: [
        {
          attemptNumber:1, submittedAt: new Date("2026-11-06T02:00:00Z"),
          publishedAt:null, finalScore:null, teacherFeedback:"Lập luận rõ ràng",
          student:{name:"Nguyễn Minh",email:"minh@example.com",profile:{studentCode:"HV001"}},
          answers:[{questionId:"q1",answerText:null,selectedChoiceIds:["c2"],autoScore:null,manualScore:null,feedback:"Tốt"}],
        },
        {
          attemptNumber:2,submittedAt:new Date("2026-11-06T04:00:00Z"),
          publishedAt:null,finalScore:null,student:{name:"Nguyễn Minh",email:"minh@example.com",profile:null},answers:[],
        },
      ],
    });
    expect(buffer.subarray(0,2).toString()).toBe("PK");
    const xml = documentXmlFromZip(buffer);
    expect(xml).toContain("BÀI LÀM 1");
    expect(xml).toContain("BÀI LÀM 2");
    expect(xml).toContain("B. Đúng");
    expect(xml).toContain("Lập luận rõ ràng");
    expect(xml).toContain("Nhận xét câu");
    expect(xml).toContain("Chưa trả lời");
  });
});

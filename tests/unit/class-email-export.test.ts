import { describe, expect, it } from "vitest";
import { collectClassContacts, classContactsCsv, classContactsTxt } from "@/modules/classes/class-email-export";
describe("class email export", () => {
  it("deduplicates by email and merges roles", () => {
    const contacts = collectClassContacts([
      {name:"An",email:"A@EXAMPLE.COM",role:"Giáo viên"},
      {name:"An",email:"a@example.com",role:"Phụ huynh"},
      {name:"Invalid",email:"bad",role:"Học sinh"},
    ]);
    expect(contacts).toHaveLength(1);
    expect(contacts[0].roles).toEqual(["Giáo viên","Phụ huynh"]);
    expect(classContactsTxt(contacts)).toContain("a@example.com");
  });
  it("escapes formula cells in CSV", () => {
    const csv = classContactsCsv([{name:"=SUM(A1)",email:"a@example.com",roles:["Học sinh"]}]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("'=SUM(A1)");
  });
});

import { deflateRawSync } from "node:zlib";
type Numberish = {toString(): string} | null;
type Q = { id: string; order: number; content: string; score: Numberish; group?: {title: string | null;content: string} | null; choices: Array<{id:string;content:string;order:number}> };
type A = {questionId:string;answerText:string|null;selectedChoiceIds:unknown;autoScore:Numberish;manualScore:Numberish;feedback:string|null};
type S = { attemptNumber:number; submittedAt:Date|null; publishedAt:Date|null; finalScore:Numberish;teacherFeedback?:string|null;student:{name:string;email:string;profile:{studentCode:string|null}|null};answers:A[];files?:Array<{asset:{originalName:string}}> };
export type WordExportData = {classCode:string;title:string;maxScore:Numberish;questions:Q[];attempts:S[]};
function escape(v:string) {return v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function run(s:string,bold=false):string {
 return '<w:r>'+(bold?'<w:rPr><w:b/></w:rPr>':'')+s.replace(/\r\n?/g,"\n").split("\n").map((p,i)=>(i?'<w:br/>':'')+'<w:t xml:space="preserve">'+escape(p)+'</w:t>').join("")+'</w:r>';
}
function para(s:string,style?:string):string {return '<w:p>'+(style?'<w:pPr><w:pStyle w:val="'+style+'"/></w:pPr>':'')+run(s)+'</w:p>';}
function item(label:string,s:string):string {return '<w:p>'+run(label+': ',true)+run(s)+'</w:p>';}
function when(d:Date|null) {return d?new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",dateStyle:"short",timeStyle:"short"}).format(d):"—";}
function answer(q:Q,a?:A):string {
 if(!a)return "(Chưa trả lời)";
 const ids=Array.isArray(a.selectedChoiceIds)?a.selectedChoiceIds.filter((x):x is string=>typeof x==="string"):[];
 const choices=[...q.choices].sort((x,y)=>x.order-y.order);
 const selected=choices.filter(c=>ids.includes(c.id));
 return selected.length?selected.map(c=>String.fromCharCode(65+choices.indexOf(c))+". "+c.content).join("\n"):a.answerText?.trim()||"(Chưa trả lời)";
}
function documentXml(d:WordExportData):string {
 const out=[para("LUYỆN THI GIÁO DỤC SÀI GÒN","Title"),para("TỔNG HỢP BÀI LÀM","Heading1"),item("Tên bài",d.title),item("Mã lớp",d.classCode),item("Số lượt đã nộp",String(d.attempts.length))];
 if(!d.attempts.length)out.push(para("Chưa có học sinh nộp bài."));
 for(const [i,s] of d.attempts.entries()){
 out.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>',para("BÀI LÀM "+(i+1)+" – "+s.student.name,"Heading1"),item("Học sinh",s.student.name),item("Mã học sinh",s.student.profile?.studentCode||"—"),item("Email",s.student.email),item("Lần làm",String(s.attemptNumber)),item("Ngày nộp",when(s.submittedAt)),item("Điểm",s.finalScore?s.finalScore.toString()+" / "+(d.maxScore?.toString()||"—"):"Chưa chấm"),item("Công bố",s.publishedAt?"Đã công bố":"Chưa công bố"));
 if(s.teacherFeedback?.trim())out.push(item("Nhận xét chung",s.teacherFeedback.trim()));
 if(s.files?.length)out.push(item("Tệp đã nộp",s.files.map(f=>f.asset.originalName).join("; ")));
 const byId=new Map(s.answers.map(a=>[a.questionId,a]));
 let lastGroup="";
 for(const q of [...d.questions].sort((a,b)=>a.order-b.order)){
 const group=(q.group?.title||"")+"|"+(q.group?.content||"");
 if(q.group&&group!==lastGroup){if(q.group.title)out.push(para(q.group.title,"Heading2"));out.push(para(q.group.content));}lastGroup=group;
 const a=byId.get(q.id);
 out.push(para("Câu "+q.order+" ("+(q.score?.toString()||"0")+" điểm)","Heading2"),para(q.content),item("Trả lời",answer(q,a)));
 const score=a?.manualScore??a?.autoScore;
 if(score!=null)out.push(item("Điểm câu",score.toString()));
 if(a?.feedback?.trim())out.push(item("Nhận xét câu",a.feedback.trim()));
 }
 }
 return '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+out.join("")+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>';
}
const crcTable=new Uint32Array(256);
for(let i=0;i<256;i++){let v=i;for(let j=0;j<8;j++)v=(v&1)?(0xedb88320^(v>>>1)):(v>>>1);crcTable[i]=v>>>0;}
function crc32(bytes:Uint8Array){let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]^(n>>>8);return(n^0xffffffff)>>>0;}
function zip(entries:Array<[string,string]>):Buffer {
 const locals:Buffer[]=[],central:Buffer[]=[];let offset=0;
 for(const [nameText,content] of entries){
 const name=Buffer.from(nameText),data=Buffer.from(content),packed=deflateRawSync(data),crc=crc32(data);
 const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt16LE(0x0800,6);h.writeUInt16LE(8,8);h.writeUInt32LE(crc,14);h.writeUInt32LE(packed.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(name.length,26);locals.push(h,name,packed);
 const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x0800,8);c.writeUInt16LE(8,10);c.writeUInt32LE(crc,16);c.writeUInt32LE(packed.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);central.push(c,name);offset+=h.length+name.length+packed.length;
 }
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(central.reduce((s,x)=>s+x.length,0),12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,...central,end]);
}
const ct='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>';
const rel='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
const docRel='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
const styles='<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style></w:styles>';
export function buildAnswersWord(data:WordExportData):Buffer {return zip([["[Content_Types].xml",ct],["_rels/.rels",rel],["word/document.xml",documentXml(data)],["word/_rels/document.xml.rels",docRel],["word/styles.xml",styles]]);}

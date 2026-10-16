import { AnalysisError } from "../documents/errors";
export async function boundedJson(request:Request,signal:AbortSignal,maxBytes=3*1024*1024):Promise<unknown> {
  if(!request.headers.get("content-type")?.startsWith("application/json")||!request.body)throw new AnalysisError("INVALID_REQUEST","의미 분석 요청 형식이 올바르지 않습니다.",400);
  if(Number(request.headers.get("content-length"))>maxBytes)throw new AnalysisError("TOTAL_TOO_LARGE","의미 분석 자료가 안전한 요청 용량을 초과했습니다. 기존 문서 검사는 보존됩니다.",413);
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  const cancel=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener("abort",cancel,{once:true});
  try {while(true){if(signal.aborted)throw new AnalysisError("REQUEST_CANCELLED","의미 분석이 취소되었습니다.",408);const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new AnalysisError("TOTAL_TOO_LARGE","의미 분석 자료가 안전한 요청 용량을 초과했습니다. 기존 검사는 보존됩니다.",413);}chunks.push(value);}}
  finally {signal.removeEventListener("abort",cancel);reader.releaseLock();}
  const bytes=new Uint8Array(size);let pos=0;for(const c of chunks){bytes.set(c,pos);pos+=c.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new AnalysisError("INVALID_REQUEST","의미 분석 자료를 읽지 못했습니다.",400);}
}

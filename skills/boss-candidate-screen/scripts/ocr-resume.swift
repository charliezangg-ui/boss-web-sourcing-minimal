import Foundation
import Vision
import ImageIO
guard CommandLine.arguments.count == 2 else {fatalError("Usage: swift ocr-resume.swift IMAGE_PATH")}
let url=URL(fileURLWithPath:CommandLine.arguments[1])
guard let src=CGImageSourceCreateWithURL(url as CFURL,nil),let img=CGImageSourceCreateImageAtIndex(src,0,nil) else {fatalError("Image missing")}
var rows:[[String:Any]]=[]
let tileHeight=2000,overlap=100
for top in stride(from:0,to:img.height,by:tileHeight-overlap){
 let h=min(tileHeight,img.height-top)
 guard let tile=img.cropping(to:CGRect(x:0,y:top,width:img.width,height:h)) else {continue}
 let req=VNRecognizeTextRequest();req.recognitionLevel = .accurate;req.recognitionLanguages=["zh-Hans","en-US"];req.usesLanguageCorrection=false
 try VNImageRequestHandler(cgImage:tile,options:[:]).perform([req])
 for o in req.results ?? [] {if let t=o.topCandidates(1).first {
 let y=Double(top)+(1-o.boundingBox.midY)*Double(h)
 if !rows.contains(where:{($0["text"] as? String)==t.string && abs(($0["y"] as! Double)-y)<25}){rows.append(["text":t.string,"confidence":t.confidence,"y":y,"x":o.boundingBox.minX])}
 }}
}
rows.sort{($0["y"] as! Double)<($1["y"] as! Double)}
FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject:rows,options:[.prettyPrinted,.sortedKeys]))

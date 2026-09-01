// OCR a scanned PDF into plain text using macOS's built-in Vision framework.
// No tesseract / ocrmypdf / poppler needed - PDFKit renders the pages and Vision
// recognises the text, both shipped with macOS.
//
//   swift scripts/ocr_pdf.swift <input.pdf> <output.txt> [startPage] [endPage]
//
// The Green Book (scripts/book_sources/1-23050Z93401O9.pdf) is a 213-page scan
// with no text layer, so it has to go through this before it can be parsed.
// Recognised best with `usesLanguageCorrection` and the .accurate level.

import Foundation
import PDFKit
import Vision
import CoreGraphics

let args = CommandLine.arguments
guard args.count >= 3 else {
    FileHandle.standardError.write(
        "usage: ocr_pdf <input.pdf> <output.txt> [startPage] [endPage]\n".data(using: .utf8)!)
    exit(1)
}

let inPath = args[1]
let outPath = args[2]
let startPage = args.count > 3 ? (Int(args[3]) ?? 1) : 1
let endPageArg = args.count > 4 ? (Int(args[4]) ?? 0) : 0

guard let doc = PDFDocument(url: URL(fileURLWithPath: inPath)) else {
    FileHandle.standardError.write("cannot open \(inPath)\n".data(using: .utf8)!)
    exit(1)
}

let pageCount = doc.pageCount
let lastPage = endPageArg > 0 ? min(endPageArg, pageCount) : pageCount
// Rendering above 1x markedly improves accuracy on 10pt book text.
let scale: CGFloat = 2.5

var output = ""
output += "=== OCR of \(inPath) pages \(startPage)-\(lastPage) ===\n"

for i in startPage...lastPage {
    output += "\n=== PAGE \(i) ===\n"
    guard let page = doc.page(at: i - 1) else { continue }

    let rect = page.bounds(for: .mediaBox)
    let w = max(1, Int(rect.width * scale))
    let h = max(1, Int(rect.height * scale))
    let cs = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8,
                              bytesPerRow: 0, space: cs,
                              bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { continue }

    // White background first, otherwise transparent areas OCR as noise.
    ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: CGFloat(w), height: CGFloat(h)))
    ctx.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: ctx)

    guard let cg = ctx.makeImage() else { continue }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(cgImage: cg, options: [:])
    do {
        try handler.perform([request])
        if let observations = request.results {
            for obs in observations {
                if let best = obs.topCandidates(1).first {
                    output += best.string + "\n"
                }
            }
        }
    } catch {
        FileHandle.standardError.write("page \(i) failed: \(error)\n".data(using: .utf8)!)
    }

    if i % 10 == 0 || i == lastPage {
        FileHandle.standardError.write("  page \(i)/\(lastPage)\n".data(using: .utf8)!)
    }
}

do {
    try output.write(toFile: outPath, atomically: true, encoding: .utf8)
    print("wrote \(outPath)")
} catch {
    FileHandle.standardError.write("write failed: \(error)\n".data(using: .utf8)!)
    exit(1)
}

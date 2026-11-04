import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
// Re-encode each PNG argument in place as opaque RGB (no alpha channel): App Store validation
// rejects app icons that carry one (ITMS-90717) even when every pixel is opaque.
//   swift src-tauri/scripts/flatten-ios-icons.swift src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset/*.png
for path in CommandLine.arguments.dropFirst() {
    let url = URL(fileURLWithPath: path)
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { fatalError("read \(path)") }
    let context = CGContext(data: nil, width: image.width, height: image.height, bitsPerComponent: 8, bytesPerRow: 0,
                            space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
    let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(destination, context.makeImage()!, nil)
    CGImageDestinationFinalize(destination)
}

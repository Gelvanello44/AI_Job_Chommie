import os
import numpy as np
from PIL import Image
import cv2

def aggressive_background_removal(input_path, output_path):
    """
    AGGRESSIVE background removal - removes ALL gray/neutral colors
    Keeps ONLY vibrant cyan and pink colors
    """
    print(f"Processing: {input_path}")
    
    # Open image
    img = Image.open(input_path)
    img = img.convert('RGBA')
    data = np.array(img)
    
    height, width = data.shape[:2]
    print(f"Image size: {width}x{height}")
    
    # Get RGB channels
    rgb = data[:, :, :3]
    
    # Convert to HSV for color detection
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    h, s, v = cv2.split(hsv)
    
    # AGGRESSIVE APPROACH:
    # 1. Keep ONLY high saturation pixels (colorful areas)
    saturation_mask = s > 50  # Much higher threshold
    
    # 2. Also specifically target cyan and pink hues
    # Cyan: hue around 90-100 (in OpenCV's 0-180 range)
    cyan_mask = np.logical_and(h > 80, h < 110)
    cyan_mask = np.logical_and(cyan_mask, s > 30)
    
    # Pink/Magenta: hue around 140-170
    pink_mask = np.logical_and(h > 130, h < 180)
    pink_mask = np.logical_and(pink_mask, s > 30)
    
    # Purple/Blue transition: hue around 110-140
    purple_mask = np.logical_and(h > 100, h < 140)
    purple_mask = np.logical_and(purple_mask, s > 40)
    
    # 3. Detect based on RGB channels - remove anything that's too gray
    r, g, b = cv2.split(rgb)
    
    # Calculate how "gray" each pixel is
    # Gray pixels have R≈G≈B
    max_rgb = np.maximum(r, np.maximum(g, b)).astype(float)
    min_rgb = np.minimum(r, np.minimum(g, b)).astype(float)
    
    # Color difference - high difference means colorful
    color_range = max_rgb - min_rgb
    
    # AGGRESSIVE: Only keep pixels with significant color difference
    color_mask = color_range > 30  # Increased threshold
    
    # 4. Combine all masks - pixel must pass at least one test
    final_mask = np.logical_or(saturation_mask, cyan_mask)
    final_mask = np.logical_or(final_mask, pink_mask)
    final_mask = np.logical_or(final_mask, purple_mask)
    final_mask = np.logical_and(final_mask, color_mask)  # Must also be colorful
    
    # Convert to uint8
    final_mask = final_mask.astype(np.uint8) * 255
    
    # Clean up small islands and holes
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    
    # Remove small noise
    final_mask = cv2.morphologyEx(final_mask, cv2.MORPH_OPEN, kernel)
    
    # Fill small holes
    final_mask = cv2.morphologyEx(final_mask, cv2.MORPH_CLOSE, kernel)
    
    # Find connected components
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(final_mask, connectivity=8)
    
    # Keep only significant components (remove tiny specs)
    min_area = 50  # Minimum area in pixels
    clean_mask = np.zeros_like(final_mask)
    
    for i in range(1, num_labels):  # Skip background (label 0)
        area = stats[i, cv2.CC_STAT_AREA]
        if area >= min_area:
            clean_mask[labels == i] = 255
    
    # Create smooth alpha channel
    # Slight dilation to avoid cutting edges too close
    kernel_dilate = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    clean_mask = cv2.dilate(clean_mask, kernel_dilate, iterations=1)
    
    # Apply distance transform for smooth edges
    dist = cv2.distanceTransform(clean_mask, cv2.DIST_L2, 5)
    dist = cv2.normalize(dist, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    
    # Very slight blur for edge smoothing
    alpha = cv2.GaussianBlur(dist, (3, 3), 1)
    
    # Make sure core areas are fully opaque
    _, core_mask = cv2.threshold(clean_mask, 127, 255, cv2.THRESH_BINARY)
    kernel_erode = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    core_mask = cv2.erode(core_mask, kernel_erode, iterations=1)
    alpha[core_mask > 0] = 255
    
    # Set alpha channel
    data[:, :, 3] = alpha
    
    # Create final image
    result = Image.fromarray(data, 'RGBA')
    result.save(output_path, 'PNG')
    
    # Calculate transparency
    transparent_pixels = np.sum(alpha < 10)  # Nearly transparent
    total_pixels = alpha.size
    transparency_percent = (transparent_pixels / total_pixels) * 100
    
    print(f" Background removed: {output_path}")
    print(f" Transparency achieved: {transparency_percent:.1f}%")
    
    return result, transparency_percent

def main():
    print("="*60)
    print("AGGRESSIVE BACKGROUND REMOVAL - 100% TRANSPARENCY TARGET")
    print("="*60)
    
    input_file = "new_ai_logo.png"
    
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found!")
        return
    
    print(f"\n Input file: {input_file}")
    
    # Process with aggressive settings
    output_file = "ai_logo_100_transparent.png"
    print("\n AGGRESSIVE background removal in progress...")
    logo, transparency = aggressive_background_removal(input_file, output_file)
    
    if transparency < 80:
        print(f"\n  Warning: Only achieved {transparency:.1f}% transparency")
        print("   The image may have large colored areas that look like background")
    else:
        print(f"\n SUCCESS: {transparency:.1f}% transparency achieved!")
    
    # Create test images
    print("\n Creating verification images...")
    
    # Checkerboard test
    logo_test = Image.open(output_file)
    checker = Image.new('RGB', logo_test.size, (255, 255, 255))
    pixels = checker.load()
    
    square_size = 25
    for i in range(0, logo_test.width, square_size):
        for j in range(0, logo_test.height, square_size):
            if ((i // square_size) + (j // square_size)) % 2:
                for x in range(i, min(i + square_size, logo_test.width)):
                    for y in range(j, min(j + square_size, logo_test.height)):
                        pixels[x, y] = (200, 200, 200)
    
    checker.paste(logo_test, (0, 0), logo_test)
    checker.save('ai_logo_100_checkerboard.png')
    print(" Checkerboard test: ai_logo_100_checkerboard.png")
    
    # Black background
    black = Image.new('RGB', logo_test.size, (0, 0, 0))
    black.paste(logo_test, (0, 0), logo_test)
    black.save('ai_logo_100_on_black.png')
    print(" Black background: ai_logo_100_on_black.png")
    
    # White background
    white = Image.new('RGB', logo_test.size, (255, 255, 255))
    white.paste(logo_test, (0, 0), logo_test)
    white.save('ai_logo_100_on_white.png')
    print(" White background: ai_logo_100_on_white.png")
    
    # Create sizes
    print("\n Creating multiple sizes...")
    sizes = [
        (2048, "ai_logo_100_2k.png", "2K"),
        (1024, "ai_logo_100_1k.png", "1K"),
        (512, "ai_logo_100_512.png", "Web"),
        (256, "ai_logo_100_256.png", "Icon Large"),
        (128, "ai_logo_100_128.png", "Icon Medium"),
        (64, "ai_logo_100_64.png", "Icon Small"),
    ]
    
    for size, filename, label in sizes:
        # Maintain aspect ratio
        logo_copy = logo.copy()
        logo_copy.thumbnail((size, size), Image.Resampling.LANCZOS)
        logo_copy.save(filename, 'PNG', optimize=True)
        file_size = os.path.getsize(filename)
        size_str = f"{file_size/1024:.1f} KB"
        print(f"   {label:12} -> {filename}")
    
    print("\n" + "="*60)
    print("PROCESSING COMPLETE!")
    print("="*60)
    print(f"\n Main file: {output_file}")
    print(" Check verification images to confirm transparency")
    print(" Multiple sizes created for all use cases")

if __name__ == "__main__":
    main()

import os
import numpy as np
from PIL import Image
import cv2

def ultra_aggressive_removal(input_path, output_path):
    """
    ULTRA AGGRESSIVE - Removes EVERYTHING that isn't pure cyan/pink
    100% transparency target - NO COMPROMISES
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
    r, g, b = cv2.split(rgb)
    
    # ULTRA AGGRESSIVE STRATEGY:
    # Remove ALL pixels that are even slightly gray
    
    # 1. Calculate "grayness" - how close R, G, B values are to each other
    rg_diff = np.abs(r.astype(float) - g.astype(float))
    gb_diff = np.abs(g.astype(float) - b.astype(float))
    rb_diff = np.abs(r.astype(float) - b.astype(float))
    
    # Maximum difference between channels
    max_diff = np.maximum(rg_diff, np.maximum(gb_diff, rb_diff))
    
    # ULTRA AGGRESSIVE: Must have VERY high color difference
    # Gray pixels have small differences, colored pixels have large differences
    color_mask = max_diff > 50  # Very high threshold
    
    # 2. Also check saturation in HSV
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    h, s, v = cv2.split(hsv)
    
    # ULTRA HIGH saturation requirement
    saturation_mask = s > 80  # Extremely high threshold
    
    # 3. Specifically target ONLY cyan and pink/magenta colors
    # Cyan: high blue and green, low red
    cyan_pixels = np.logical_and(b > 100, g > 100)
    cyan_pixels = np.logical_and(cyan_pixels, r < 150)
    
    # Pink/Magenta: high red and blue, lower green
    pink_pixels = np.logical_and(r > 100, b > 100)
    pink_pixels = np.logical_and(pink_pixels, g < 150)
    
    # Purple (transition): high red and blue
    purple_pixels = np.logical_and(r > 80, b > 80)
    purple_pixels = np.logical_and(purple_pixels, max_diff > 40)
    
    # 4. Combine masks - must be BOTH colorful AND the right color
    color_specific = np.logical_or(cyan_pixels, pink_pixels)
    color_specific = np.logical_or(color_specific, purple_pixels)
    
    # Final mask: must be colorful AND saturated AND the right color
    final_mask = np.logical_and(color_mask, saturation_mask)
    final_mask = np.logical_and(final_mask, color_specific)
    
    # Also remove any pixel that's too dark or too bright (likely shadows/highlights)
    brightness = v
    brightness_mask = np.logical_and(brightness > 50, brightness < 250)
    final_mask = np.logical_and(final_mask, brightness_mask)
    
    # Convert to uint8
    final_mask = final_mask.astype(np.uint8) * 255
    
    # Aggressive noise removal
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    
    # Remove ALL small islands
    final_mask = cv2.morphologyEx(final_mask, cv2.MORPH_OPEN, kernel, iterations=2)
    
    # Close small gaps
    final_mask = cv2.morphologyEx(final_mask, cv2.MORPH_CLOSE, kernel)
    
    # Find connected components and keep only LARGE ones
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(final_mask, connectivity=8)
    
    # Very high minimum area to remove all small artifacts
    min_area = 200  # Increased threshold
    clean_mask = np.zeros_like(final_mask)
    
    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        if area >= min_area:
            clean_mask[labels == i] = 255
    
    # Minimal dilation to keep edges clean
    kernel_small = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    clean_mask = cv2.dilate(clean_mask, kernel_small, iterations=1)
    
    # Sharp edges - minimal smoothing
    alpha = clean_mask.copy()
    
    # Very minimal edge smoothing
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0.5)
    
    # Hard threshold to ensure clean edges
    _, alpha = cv2.threshold(alpha, 50, 255, cv2.THRESH_BINARY)
    
    # Set alpha channel
    data[:, :, 3] = alpha
    
    # EXTRA STEP: Double-check and remove any remaining gray pixels
    for y in range(height):
        for x in range(width):
            if alpha[y, x] > 0:  # If pixel is visible
                pixel_r, pixel_g, pixel_b = rgb[y, x]
                
                # Check if pixel is too gray (R≈G≈B)
                pixel_max = max(pixel_r, pixel_g, pixel_b)
                pixel_min = min(pixel_r, pixel_g, pixel_b)
                pixel_range = pixel_max - pixel_min
                
                # If color range is too small, it's gray - remove it
                if pixel_range < 40:
                    data[y, x, 3] = 0  # Make transparent
    
    # Create final image
    result = Image.fromarray(data, 'RGBA')
    result.save(output_path, 'PNG')
    
    # Calculate transparency
    alpha_final = data[:, :, 3]
    transparent_pixels = np.sum(alpha_final == 0)
    total_pixels = alpha_final.size
    transparency_percent = (transparent_pixels / total_pixels) * 100
    
    print(f" Background removed: {output_path}")
    print(f" TRANSPARENCY ACHIEVED: {transparency_percent:.1f}%")
    
    return result, transparency_percent

def main():
    print("="*60)
    print("ULTRA AGGRESSIVE REMOVAL - 100% TRANSPARENCY MODE")
    print("="*60)
    
    input_file = "new_ai_logo.png"
    
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found!")
        return
    
    print(f"\n Input: {input_file}")
    
    # Process with ULTRA settings
    output_file = "ai_logo_ULTRA_clean.png"
    print("\n ULTRA AGGRESSIVE removal starting...")
    logo, transparency = ultra_aggressive_removal(input_file, output_file)
    
    print(f"\n{'' if transparency > 90 else ''} Final transparency: {transparency:.1f}%")
    
    # Create verification images
    print("\n Creating verification images...")
    
    # Checkerboard
    logo_test = Image.open(output_file)
    checker = Image.new('RGB', logo_test.size, (255, 255, 255))
    pixels = checker.load()
    
    square_size = 30
    for i in range(0, logo_test.width, square_size):
        for j in range(0, logo_test.height, square_size):
            if ((i // square_size) + (j // square_size)) % 2:
                for x in range(i, min(i + square_size, logo_test.width)):
                    for y in range(j, min(j + square_size, logo_test.height)):
                        pixels[x, y] = (220, 220, 220)
    
    checker.paste(logo_test, (0, 0), logo_test)
    checker.save('ai_logo_ULTRA_checkerboard.png')
    print(" Checkerboard: ai_logo_ULTRA_checkerboard.png")
    
    # Black background
    black = Image.new('RGB', logo_test.size, (0, 0, 0))
    black.paste(logo_test, (0, 0), logo_test)
    black.save('ai_logo_ULTRA_black.png')
    print(" Black test: ai_logo_ULTRA_black.png")
    
    # White background
    white = Image.new('RGB', logo_test.size, (255, 255, 255))
    white.paste(logo_test, (0, 0), logo_test)
    white.save('ai_logo_ULTRA_white.png')
    print(" White test: ai_logo_ULTRA_white.png")
    
    # Create final sizes
    print("\n Creating final sizes...")
    sizes = [
        (2048, "ai_logo_FINAL_2k.png"),
        (1024, "ai_logo_FINAL_1k.png"),
        (512, "ai_logo_FINAL_512.png"),
        (256, "ai_logo_FINAL_256.png"),
        (128, "ai_logo_FINAL_128.png"),
        (64, "ai_logo_FINAL_64.png"),
        (32, "ai_logo_FINAL_32.png"),
    ]
    
    for size, filename in sizes:
        resized = logo.copy()
        resized.thumbnail((size, size), Image.Resampling.LANCZOS)
        resized.save(filename, 'PNG', optimize=True)
        print(f"   {size:4}px -> {filename}")
    
    print("\n" + "="*60)
    print(" ULTRA PROCESSING COMPLETE!")
    print("="*60)
    print(f"\n Main file: {output_file}")
    print(f" Transparency: {transparency:.1f}%")
    print(" Check ai_logo_ULTRA_checkerboard.png to verify")

if __name__ == "__main__":
    main()

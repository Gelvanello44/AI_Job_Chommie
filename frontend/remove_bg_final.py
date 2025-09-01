import os
import numpy as np
from PIL import Image
import cv2

def remove_background_precise(input_path, output_path):
    """
    Precise background removal that preserves the logo completely
    Specifically for cyan/pink gradient AI logo
    """
    print(f"Processing: {input_path}")
    
    # Open and convert to RGBA
    img = Image.open(input_path)
    img = img.convert('RGBA')
    data = np.array(img)
    
    # Get dimensions
    height, width = data.shape[:2]
    print(f"Image size: {width}x{height}")
    
    # Get RGB channels
    rgb = data[:, :, :3]
    
    # Convert to HSV for better color detection
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    
    # Extract individual channels
    h, s, v = cv2.split(hsv)
    
    # The logo has high saturation, background is gray (low saturation)
    # Create mask based on saturation
    saturation_mask = s > 20  # Lower threshold to capture all logo parts
    
    # Also detect based on color deviation from gray
    # Gray pixels have R≈G≈B
    r, g, b = cv2.split(rgb)
    
    # Calculate how much each pixel deviates from gray
    rg_diff = np.abs(r.astype(float) - g.astype(float))
    gb_diff = np.abs(g.astype(float) - b.astype(float))
    rb_diff = np.abs(r.astype(float) - b.astype(float))
    
    # Maximum color difference
    max_diff = np.maximum(rg_diff, np.maximum(gb_diff, rb_diff))
    
    # Pixels with color difference > 10 are likely part of the logo
    color_mask = max_diff > 10
    
    # Combine both masks
    combined_mask = np.logical_or(saturation_mask, color_mask).astype(np.uint8) * 255
    
    # Clean up with morphological operations
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    
    # Close small gaps
    combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    
    # Remove small noise
    combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_OPEN, kernel)
    
    # Dilate to include glow/edge effects
    kernel_dilate = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    combined_mask = cv2.dilate(combined_mask, kernel_dilate, iterations=1)
    
    # Find contours and keep significant ones
    contours, _ = cv2.findContours(combined_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Create clean mask from significant contours
    final_mask = np.zeros(combined_mask.shape, dtype=np.uint8)
    
    if contours:
        # Filter out tiny contours (noise)
        significant_contours = [c for c in contours if cv2.contourArea(c) > 100]
        
        if significant_contours:
            # Draw all significant contours
            cv2.drawContours(final_mask, significant_contours, -1, 255, -1)
            
            # Create smooth alpha channel using distance transform
            dist = cv2.distanceTransform(final_mask, cv2.DIST_L2, 5)
            
            # Normalize to 0-255 range
            dist = cv2.normalize(dist, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
            
            # Apply Gaussian blur for smooth edges
            alpha = cv2.GaussianBlur(dist, (5, 5), 1)
            
            # Clean up very faint pixels
            alpha[alpha < 5] = 0
            
            # Ensure strong areas are fully opaque
            _, strong_mask = cv2.threshold(final_mask, 127, 255, cv2.THRESH_BINARY)
            kernel_small = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            strong_mask = cv2.erode(strong_mask, kernel_small, iterations=1)
            alpha[strong_mask > 0] = 255
    else:
        print("Warning: No contours found!")
        alpha = np.zeros((height, width), dtype=np.uint8)
    
    # Set the alpha channel
    data[:, :, 3] = alpha
    
    # Create final image
    result = Image.fromarray(data, 'RGBA')
    
    # Save the result
    result.save(output_path, 'PNG')
    
    # Calculate and report transparency
    transparent_pixels = np.sum(alpha < 128)
    total_pixels = alpha.size
    transparency_percent = (transparent_pixels / total_pixels) * 100
    
    print(f" Background removed: {output_path}")
    print(f" Transparency: {transparency_percent:.1f}% transparent")
    
    return result

def create_verification_images(logo_path):
    """Create test images to verify transparency"""
    logo = Image.open(logo_path)
    
    # 1. Checkerboard test
    checker = Image.new('RGB', logo.size, (255, 255, 255))
    pixels = checker.load()
    
    square_size = 30
    for i in range(0, logo.width, square_size):
        for j in range(0, logo.height, square_size):
            if ((i // square_size) + (j // square_size)) % 2:
                for x in range(i, min(i + square_size, logo.width)):
                    for y in range(j, min(j + square_size, logo.height)):
                        pixels[x, y] = (230, 230, 230)
    
    checker.paste(logo, (0, 0), logo)
    checker_path = logo_path.replace('.png', '_checkerboard.png')
    checker.save(checker_path)
    print(f" Checkerboard test: {checker_path}")
    
    # 2. Black background test
    black_bg = Image.new('RGB', logo.size, (0, 0, 0))
    black_bg.paste(logo, (0, 0), logo)
    black_path = logo_path.replace('.png', '_on_black.png')
    black_bg.save(black_path)
    print(f" Black background test: {black_path}")
    
    # 3. White background test
    white_bg = Image.new('RGB', logo.size, (255, 255, 255))
    white_bg.paste(logo, (0, 0), logo)
    white_path = logo_path.replace('.png', '_on_white.png')
    white_bg.save(white_path)
    print(f" White background test: {white_path}")

def main():
    print("="*60)
    print("AI LOGO BACKGROUND REMOVAL - FINAL VERSION")
    print("="*60)
    
    # Look for the input file
    input_file = None
    possible_names = [
        "new_ai_logo.png", "new_ai_logo.jpg",
        "ai_logo_new.png", "ai_logo_new.jpg",
        "logo_new.png", "logo_new.jpg",
        "latest_logo.png", "latest_logo.jpg"
    ]
    
    # Check if user provided a specific file
    for name in possible_names:
        if os.path.exists(name):
            input_file = name
            break
    
    if not input_file:
        print("\n  Please save the new image as one of these names:")
        for name in possible_names[:4]:
            print(f"   - {name}")
        print("\nThen run this script again.")
        return
    
    print(f"\n Found input file: {input_file}")
    
    # Process the image
    output_file = "ai_logo_no_bg_final.png"
    print("\n Removing background...")
    logo = remove_background_precise(input_file, output_file)
    
    # Create verification images
    print("\n Creating verification images...")
    create_verification_images(output_file)
    
    # Create multiple sizes
    print("\n Creating different sizes...")
    sizes = [
        (2048, "ai_logo_no_bg_2k.png", "2K"),
        (1024, "ai_logo_no_bg_1k.png", "1K"),
        (512, "ai_logo_no_bg_512.png", "Web"),
        (256, "ai_logo_no_bg_256.png", "Icon Large"),
        (128, "ai_logo_no_bg_128.png", "Icon Medium"),
        (64, "ai_logo_no_bg_64.png", "Icon Small"),
    ]
    
    for size, filename, label in sizes:
        resized = logo.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(filename, 'PNG', optimize=True)
        file_size = os.path.getsize(filename)
        size_str = f"{file_size/1024:.1f} KB" if file_size < 1024*1024 else f"{file_size/(1024*1024):.2f} MB"
        print(f"   {label:12} -> {filename:25} [{size:4}x{size:4}] {size_str:>10}")
    
    print("\n" + "="*60)
    print(" SUCCESS! Background removed from your logo")
    print("="*60)
    print(f"\n Main file: {output_file}")
    print(" Check the verification images to confirm transparency")
    print(" Multiple sizes created for different uses")

if __name__ == "__main__":
    main()

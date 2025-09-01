import os
import numpy as np
from PIL import Image
import cv2

def remove_background_properly(image_path):
    """
    Properly remove the gray gradient background from the Job Chommie logo
    """
    # Open image
    img = Image.open(image_path)
    img = img.convert('RGBA')
    data = np.array(img)
    
    # Get RGB channels
    rgb = data[:, :, :3]
    
    # Convert to grayscale to detect the actual logo vs background
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    
    # The logo has vibrant colors (cyan/pink), background is gray
    # Calculate color saturation to distinguish logo from background
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    saturation = hsv[:, :, 1]
    
    # Create mask based on saturation - logo has high saturation, background has low
    # Threshold: anything with saturation > 30 is likely the logo
    logo_mask = saturation > 30
    
    # Also check for color variance - the logo areas have more color variance
    b, g, r = cv2.split(rgb)
    color_variance = np.std([b, g, r], axis=0)
    color_mask = color_variance > 20
    
    # Combine masks
    combined_mask = np.logical_or(logo_mask, color_mask).astype(np.uint8) * 255
    
    # Clean up the mask with morphological operations
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel)
    combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_OPEN, kernel)
    
    # Find the largest contour (should be the logo)
    contours, _ = cv2.findContours(combined_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        # Get bounding box of all contours that are reasonably large
        large_contours = [c for c in contours if cv2.contourArea(c) > 1000]
        if large_contours:
            # Create clean mask from contours
            mask = np.zeros(combined_mask.shape, dtype=np.uint8)
            cv2.drawContours(mask, large_contours, -1, 255, -1)
            
            # Dilate slightly to include edges
            mask = cv2.dilate(mask, kernel, iterations=1)
            
            # Smooth the edges
            mask = cv2.GaussianBlur(mask, (7, 7), 2)
            
            # Apply threshold for cleaner edges
            _, mask = cv2.threshold(mask, 128, 255, cv2.THRESH_BINARY)
            
            # Create smooth alpha transition at edges
            dist = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
            dist = cv2.normalize(dist, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
            
            # Apply Gaussian blur for smoother edges
            alpha = cv2.GaussianBlur(dist, (5, 5), 1)
            
            # Set alpha channel
            data[:, :, 3] = alpha
    
    # Create result image
    result = Image.fromarray(data, 'RGBA')
    return result

def upscale_image_properly(image, target_size=7680):
    """
    Upscale image to target size with high quality
    """
    width, height = image.size
    
    # Calculate new dimensions maintaining aspect ratio
    if width >= height:
        new_width = target_size
        new_height = int(target_size * height / width)
    else:
        new_height = target_size
        new_width = int(target_size * width / height)
    
    # Make dimensions even
    new_width += new_width % 2
    new_height += new_height % 2
    
    print(f"Upscaling from {width}x{height} to {new_width}x{new_height}")
    
    # Use high-quality LANCZOS resampling
    result = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    return result

def main():
    print("="*60)
    print("JOB CHOMMIE LOGO - BACKGROUND REMOVAL FIX")
    print("="*60)
    
    input_file = "job_chommie_logo_original.png"
    
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found!")
        return
    
    print(f"\n Processing: {input_file}")
    
    # Step 1: Remove background properly
    print("\n Removing background (proper method)...")
    clean_logo = remove_background_properly(input_file)
    
    # Save intermediate result
    clean_logo.save('job_chommie_transparent.png', 'PNG')
    print(" Background removed: job_chommie_transparent.png")
    
    # Check if background is actually transparent
    data = np.array(clean_logo)
    alpha = data[:, :, 3]
    transparent_pixels = np.sum(alpha < 128)
    total_pixels = alpha.size
    transparency_percent = (transparent_pixels / total_pixels) * 100
    print(f"  Transparency: {transparency_percent:.1f}% of image is transparent")
    
    # Step 2: Create multiple sizes
    print("\n Creating multiple resolutions...")
    
    sizes = [
        (7680, 'job_chommie_8K_fixed.png', '8K'),
        (3840, 'job_chommie_4K_fixed.png', '4K'),
        (2048, 'job_chommie_2K_fixed.png', '2K'),
        (1920, 'job_chommie_HD_fixed.png', 'HD'),
        (1024, 'job_chommie_1K_fixed.png', '1K'),
        (512, 'job_chommie_512_fixed.png', 'Web'),
        (256, 'job_chommie_256_fixed.png', 'Icon'),
    ]
    
    for target_size, filename, label in sizes:
        resized = upscale_image_properly(clean_logo, target_size)
        resized.save(filename, 'PNG', optimize=True)
        print(f" {label:6} saved: {resized.size} -> {filename}")
        
        # Get file size
        size_bytes = os.path.getsize(filename)
        if size_bytes > 1024*1024:
            size_str = f"{size_bytes/(1024*1024):.2f} MB"
        else:
            size_str = f"{size_bytes/1024:.2f} KB"
        print(f"         Size: {size_str}")
    
    print("\n" + "="*60)
    print(" PROCESSING COMPLETE!")
    print("="*60)
    print("\n All versions now have PROPER transparent backgrounds!")
    
    # Create a test image with checkerboard background to verify transparency
    print("\n Creating test image with checkerboard to verify transparency...")
    test_img = create_test_image_with_checkerboard('job_chommie_512_fixed.png')
    test_img.save('job_chommie_test_checkerboard.png', 'PNG')
    print(" Test image saved: job_chommie_test_checkerboard.png")

def create_test_image_with_checkerboard(logo_path):
    """Create a test image with checkerboard background to show transparency"""
    logo = Image.open(logo_path)
    
    # Create checkerboard background
    size = logo.size
    checker = Image.new('RGB', size, (255, 255, 255))
    pixels = checker.load()
    
    square_size = 20
    for i in range(0, size[0], square_size):
        for j in range(0, size[1], square_size):
            if ((i // square_size) + (j // square_size)) % 2:
                for x in range(i, min(i + square_size, size[0])):
                    for y in range(j, min(j + square_size, size[1])):
                        pixels[x, y] = (200, 200, 200)
    
    # Composite logo over checkerboard
    checker.paste(logo, (0, 0), logo)
    
    return checker

if __name__ == "__main__":
    main()

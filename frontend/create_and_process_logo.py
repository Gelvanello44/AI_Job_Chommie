import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import cv2

def create_job_chommie_logo():
    """Create a logo similar to Job Chommie style with gradient effect"""
    # Create a high-resolution base image
    width, height = 2048, 2048
    logo = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(logo)
    
    # Create background (gray gradient)
    for y in range(height):
        gray_value = int(100 + (128 - 100) * (y / height))
        draw.rectangle([(0, y), (width, y+1)], fill=(gray_value, gray_value, gray_value, 255))
    
    # Create the stylized wave/AI shape
    # Draw a flowing wave-like shape similar to the Job Chommie logo
    center_x, center_y = width // 2, height // 2
    
    # Create gradient effect for the logo
    gradient_img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    gradient_draw = ImageDraw.Draw(gradient_img)
    
    # Draw the main wave shape (similar to the 'AI' or wave in Job Chommie)
    # Left part (cyan/blue gradient)
    points_left = []
    for i in range(100):
        t = i / 100
        x = center_x - 300 + t * 300
        y = center_y + 100 * np.sin(t * np.pi * 2) - 100
        points_left.append((x, y))
    
    for i in range(len(points_left) - 1):
        x1, y1 = points_left[i]
        x2, y2 = points_left[i + 1]
        # Cyan gradient
        color_val = int(255 * (1 - i / len(points_left)))
        gradient_draw.ellipse([x1-60, y1-60, x1+60, y1+60], 
                             fill=(0, color_val, 255, 200))
    
    # Right part (pink/magenta gradient)
    points_right = []
    for i in range(100):
        t = i / 100
        x = center_x + t * 300
        y = center_y - 100 * np.sin(t * np.pi * 2) - 100
        points_right.append((x, y))
    
    for i in range(len(points_right) - 1):
        x1, y1 = points_right[i]
        x2, y2 = points_right[i + 1]
        # Pink gradient
        color_val = int(255 * (1 - i / len(points_right)))
        gradient_draw.ellipse([x1-60, y1-60, x1+60, y1+60], 
                             fill=(255, 0, color_val, 200))
    
    # Draw the dot (like the 'i' dot in the logo)
    dot_x, dot_y = center_x + 200, center_y - 300
    gradient_draw.ellipse([dot_x-80, dot_y-80, dot_x+80, dot_y+80], 
                         fill=(255, 0, 255, 220))
    
    # Apply blur for smooth gradient effect
    gradient_img = gradient_img.filter(ImageFilter.GaussianBlur(radius=20))
    
    # Composite the gradient onto the background
    logo = Image.alpha_composite(logo, gradient_img)
    
    # Add glow effect
    glow = gradient_img.filter(ImageFilter.GaussianBlur(radius=50))
    logo = Image.alpha_composite(logo, glow)
    
    # Add "Job Chommie" text
    # Note: For better text, you'd need a proper font file
    text_img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    text_draw = ImageDraw.Draw(text_img)
    
    # Simple text (would be better with a custom font)
    text = "Job Chommie"
    # Calculate text position
    text_y = center_y + 350
    
    # Draw text with glow effect
    for offset in range(10, 0, -2):
        alpha = int(255 * (1 - offset / 10))
        text_draw.text((center_x - 200, text_y), text, 
                      fill=(255, 255, 255, alpha), anchor="mm")
    
    text_draw.text((center_x - 200, text_y), text, 
                  fill=(255, 255, 255, 255), anchor="mm")
    
    logo = Image.alpha_composite(logo, text_img)
    
    return logo

def remove_background_advanced(image):
    """Advanced background removal preserving logo quality"""
    img_array = np.array(image)
    
    if img_array.shape[2] == 3:
        h, w = img_array.shape[:2]
        img_rgba = np.zeros((h, w, 4), dtype=np.uint8)
        img_rgba[:, :, :3] = img_array
        img_rgba[:, :, 3] = 255
        img_array = img_rgba
    
    # Convert to HSV for better color detection
    img_rgb = img_array[:, :, :3]
    hsv = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2HSV)
    
    # Create multiple masks for different color ranges
    # Mask for gray background
    lower_gray = np.array([0, 0, 50])
    upper_gray = np.array([180, 30, 150])
    gray_mask = cv2.inRange(hsv, lower_gray, upper_gray)
    
    # Mask for very dark areas (potential background)
    lower_dark = np.array([0, 0, 0])
    upper_dark = np.array([180, 255, 50])
    dark_mask = cv2.inRange(hsv, lower_dark, upper_dark)
    
    # Combine masks
    background_mask = cv2.bitwise_or(gray_mask, dark_mask)
    
    # Clean up the mask
    kernel = np.ones((5, 5), np.uint8)
    background_mask = cv2.morphologyEx(background_mask, cv2.MORPH_OPEN, kernel)
    background_mask = cv2.morphologyEx(background_mask, cv2.MORPH_CLOSE, kernel)
    
    # Find contours to identify the main logo
    contours, _ = cv2.findContours(cv2.bitwise_not(background_mask), 
                                   cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Create a clean mask for the logo
    logo_mask = np.zeros(background_mask.shape, dtype=np.uint8)
    if contours:
        # Find the largest contour (likely the logo)
        largest_contour = max(contours, key=cv2.contourArea)
        cv2.drawContours(logo_mask, [largest_contour], -1, 255, -1)
    
    # Refine edges with alpha matting technique
    logo_mask = cv2.GaussianBlur(logo_mask, (7, 7), 0)
    
    # Apply the mask to alpha channel
    img_array[:, :, 3] = logo_mask
    
    # Convert back to PIL Image
    result = Image.fromarray(img_array, 'RGBA')
    
    return result

def upscale_to_8k_ultra_quality(image, target_width=7680, target_height=4320):
    """Ultra-quality upscaling to 8K using advanced techniques"""
    width, height = image.size
    aspect_ratio = width / height
    
    # Calculate target dimensions maintaining aspect ratio
    if aspect_ratio > (target_width / target_height):
        new_width = target_width
        new_height = int(target_width / aspect_ratio)
    else:
        new_height = target_height
        new_width = int(target_height * aspect_ratio)
    
    # Ensure dimensions are even (required for some operations)
    new_width = new_width if new_width % 2 == 0 else new_width + 1
    new_height = new_height if new_height % 2 == 0 else new_height + 1
    
    img_array = np.array(image)
    
    # Progressive upscaling for maximum quality
    current_array = img_array
    current_width, current_height = width, height
    
    print(f"Starting upscale from {width}x{height} to {new_width}x{new_height}")
    
    # Step 1: Initial upscale using LANCZOS4
    if current_width < new_width or current_height < new_height:
        scale_factor = min(new_width / current_width, new_height / current_height)
        
        # Use progressive scaling for better quality
        steps = []
        temp_scale = 1.0
        while temp_scale < scale_factor:
            temp_scale *= 1.5
            if temp_scale > scale_factor:
                steps.append(scale_factor)
            else:
                steps.append(temp_scale)
        
        for step_scale in steps:
            step_width = int(width * step_scale)
            step_height = int(height * step_scale)
            
            # Ensure even dimensions
            step_width = step_width if step_width % 2 == 0 else step_width + 1
            step_height = step_height if step_height % 2 == 0 else step_height + 1
            
            print(f"  Upscaling step: {current_width}x{current_height} -> {step_width}x{step_height}")
            
            # Use INTER_LANCZOS4 for highest quality
            current_array = cv2.resize(current_array, (step_width, step_height),
                                      interpolation=cv2.INTER_LANCZOS4)
            
            # Apply edge enhancement
            if current_array.shape[2] == 4:
                rgb = current_array[:, :, :3]
                alpha = current_array[:, :, 3]
                
                # Edge enhancement on RGB
                kernel = np.array([[-1, -1, -1],
                                  [-1,  9, -1],
                                  [-1, -1, -1]]) / 9
                rgb = cv2.filter2D(rgb, -1, kernel)
                
                current_array[:, :, :3] = rgb
            
            current_width, current_height = step_width, step_height
    
    # Final resize to exact target dimensions
    if (current_width, current_height) != (new_width, new_height):
        print(f"  Final adjustment: {current_width}x{current_height} -> {new_width}x{new_height}")
        current_array = cv2.resize(current_array, (new_width, new_height),
                                  interpolation=cv2.INTER_LANCZOS4)
    
    # Step 2: Advanced denoising
    if current_array.shape[2] == 4:
        rgb = current_array[:, :, :3]
        alpha = current_array[:, :, 3]
        rgb = cv2.fastNlMeansDenoisingColored(rgb, None, 2, 2, 7, 21)
        current_array[:, :, :3] = rgb
    else:
        current_array = cv2.fastNlMeansDenoisingColored(current_array, None, 2, 2, 7, 21)
    
    # Step 3: Adaptive sharpening
    if current_array.shape[2] == 4:
        rgb = current_array[:, :, :3]
        
        # Convert to LAB for better processing
        lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        
        # Apply CLAHE for contrast enhancement
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(16, 16))
        l = clahe.apply(l)
        
        # Merge and convert back
        lab = cv2.merge([l, a, b])
        rgb = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)
        
        current_array[:, :, :3] = rgb
    
    # Convert back to PIL Image
    result = Image.fromarray(current_array, 'RGBA' if current_array.shape[2] == 4 else 'RGB')
    
    return result, new_width, new_height

def main():
    print("Job Chommie Logo Processor - Ultra Quality Edition")
    print("=" * 60)
    
    # Step 1: Create or load the logo
    print("\nStep 1: Creating Job Chommie style logo...")
    logo = create_job_chommie_logo()
    logo.save('job_chommie_original.png', 'PNG')
    print(f" Original logo created: {logo.size}")
    
    # Step 2: Remove background
    print("\nStep 2: Removing background with advanced algorithm...")
    no_bg_logo = remove_background_advanced(logo)
    no_bg_logo.save('job_chommie_no_bg.png', 'PNG')
    print(" Background removed successfully")
    
    # Step 3: Upscale to 8K
    print("\nStep 3: Upscaling to 8K Ultra HD resolution...")
    upscaled_logo, final_width, final_height = upscale_to_8k_ultra_quality(no_bg_logo)
    
    # Save the 8K version
    output_8k = 'job_chommie_8k_ultra.png'
    print(f"\nSaving 8K version ({final_width}x{final_height})...")
    upscaled_logo.save(output_8k, 'PNG', optimize=False, compress_level=0)
    
    # Create optimized versions
    print("\nCreating additional optimized versions...")
    
    # 4K version
    logo_4k = upscaled_logo.copy()
    logo_4k.thumbnail((3840, 2160), Image.Resampling.LANCZOS)
    logo_4k.save('job_chommie_4k.png', 'PNG', optimize=True)
    print(f" 4K version saved: {logo_4k.size}")
    
    # Full HD version
    logo_fhd = upscaled_logo.copy()
    logo_fhd.thumbnail((1920, 1080), Image.Resampling.LANCZOS)
    logo_fhd.save('job_chommie_fullhd.png', 'PNG', optimize=True)
    print(f" Full HD version saved: {logo_fhd.size}")
    
    # Web version
    logo_web = upscaled_logo.copy()
    logo_web.thumbnail((512, 512), Image.Resampling.LANCZOS)
    logo_web.save('job_chommie_web.png', 'PNG', optimize=True)
    print(f" Web version saved: {logo_web.size}")
    
    # Print summary
    print("\n" + "=" * 60)
    print("PROCESSING COMPLETE!")
    print("=" * 60)
    print(f"\n 8K Ultra HD: {final_width}x{final_height} - {output_8k}")
    print(f"   File size: {os.path.getsize(output_8k) / (1024*1024):.2f} MB")
    print(f"\n 4K Version: job_chommie_4k.png")
    print(f"   File size: {os.path.getsize('job_chommie_4k.png') / (1024*1024):.2f} MB")
    print(f"\n Full HD Version: job_chommie_fullhd.png")
    print(f"   File size: {os.path.getsize('job_chommie_fullhd.png') / 1024:.2f} KB")
    print(f"\n Web Version: job_chommie_web.png")
    print(f"   File size: {os.path.getsize('job_chommie_web.png') / 1024:.2f} KB")
    
    print("\nAll versions have transparent backgrounds and maximum quality!")

if __name__ == "__main__":
    main()

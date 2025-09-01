import os
import numpy as np
from PIL import Image
import cv2
import requests
from io import BytesIO

def download_image(url):
    """Download image from URL"""
    response = requests.get(url)
    img = Image.open(BytesIO(response.content))
    return img

def remove_background(image):
    """Remove background from image using color detection and alpha channel"""
    # Convert PIL image to numpy array
    img_array = np.array(image)
    
    # Convert to RGBA if not already
    if img_array.shape[2] == 3:
        # Add alpha channel
        h, w = img_array.shape[:2]
        img_rgba = np.zeros((h, w, 4), dtype=np.uint8)
        img_rgba[:, :, :3] = img_array
        img_rgba[:, :, 3] = 255
        img_array = img_rgba
    
    # Create a mask for the background (gray areas)
    # Convert to HSV for better color detection
    img_rgb = img_array[:, :, :3]
    hsv = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2HSV)
    
    # Define range for gray background
    # Gray has low saturation in HSV
    lower_gray = np.array([0, 0, 80])
    upper_gray = np.array([180, 30, 140])
    
    # Create mask for background
    background_mask = cv2.inRange(hsv, lower_gray, upper_gray)
    
    # Invert mask to get foreground
    foreground_mask = cv2.bitwise_not(background_mask)
    
    # Apply some morphological operations to clean up the mask
    kernel = np.ones((3, 3), np.uint8)
    foreground_mask = cv2.morphologyEx(foreground_mask, cv2.MORPH_CLOSE, kernel)
    foreground_mask = cv2.morphologyEx(foreground_mask, cv2.MORPH_OPEN, kernel)
    
    # Apply Gaussian blur to soften edges
    foreground_mask = cv2.GaussianBlur(foreground_mask, (5, 5), 0)
    
    # Set alpha channel based on mask
    img_array[:, :, 3] = foreground_mask
    
    # Convert back to PIL Image
    result = Image.fromarray(img_array, 'RGBA')
    
    return result

def upscale_to_8k(image, target_width=7680, target_height=4320):
    """
    Upscale image to 8K resolution using advanced interpolation
    8K resolution is 7680×4320 pixels
    """
    # Get current dimensions
    width, height = image.size
    
    # Calculate aspect ratio
    aspect_ratio = width / height
    
    # Determine target dimensions while maintaining aspect ratio
    if aspect_ratio > (target_width / target_height):
        # Image is wider
        new_width = target_width
        new_height = int(target_width / aspect_ratio)
    else:
        # Image is taller or square
        new_height = target_height
        new_width = int(target_height * aspect_ratio)
    
    # Convert to numpy array for cv2 processing
    img_array = np.array(image)
    
    # Use multiple upscaling steps for better quality
    current_width, current_height = width, height
    
    # Upscale gradually for better quality
    while current_width < new_width or current_height < new_height:
        # Calculate next step (max 2x at a time)
        scale_factor = min(2.0, max(new_width / current_width, new_height / current_height))
        
        next_width = min(int(current_width * scale_factor), new_width)
        next_height = min(int(current_height * scale_factor), new_height)
        
        # Use INTER_CUBIC for upscaling
        img_array = cv2.resize(img_array, (next_width, next_height), 
                               interpolation=cv2.INTER_CUBIC)
        
        current_width, current_height = next_width, next_height
        
        # Apply slight sharpening after each upscale
        if current_width < new_width or current_height < new_height:
            kernel = np.array([[-1,-1,-1],
                              [-1, 9,-1],
                              [-1,-1,-1]]) / 9
            img_array = cv2.filter2D(img_array, -1, kernel)
    
    # Final resize to exact dimensions if needed
    if (current_width, current_height) != (new_width, new_height):
        img_array = cv2.resize(img_array, (new_width, new_height), 
                              interpolation=cv2.INTER_LANCZOS4)
    
    # Apply final enhancement
    # Denoise
    if img_array.shape[2] == 4:
        # Handle alpha channel separately
        rgb = img_array[:, :, :3]
        alpha = img_array[:, :, 3]
        rgb = cv2.fastNlMeansDenoisingColored(rgb, None, 3, 3, 7, 21)
        img_array[:, :, :3] = rgb
    else:
        img_array = cv2.fastNlMeansDenoisingColored(img_array, None, 3, 3, 7, 21)
    
    # Convert back to PIL Image
    result = Image.fromarray(img_array, 'RGBA' if img_array.shape[2] == 4 else 'RGB')
    
    return result, new_width, new_height

def enhance_quality(image):
    """Apply additional quality enhancements"""
    # Convert to numpy array
    img_array = np.array(image)
    
    # Enhance contrast using CLAHE on the RGB channels
    if img_array.shape[2] == 4:
        # Handle alpha channel separately
        rgb = img_array[:, :, :3]
        alpha = img_array[:, :, 3]
        
        # Convert to LAB color space for better contrast enhancement
        lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        
        # Apply CLAHE to L channel
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        
        # Merge channels
        lab = cv2.merge([l, a, b])
        rgb = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)
        
        img_array[:, :, :3] = rgb
    
    # Convert back to PIL Image
    result = Image.fromarray(img_array, 'RGBA' if img_array.shape[2] == 4 else 'RGB')
    
    return result

def main():
    print("Job Chommie Logo Processor")
    print("=" * 50)
    
    # Check if logo file exists locally first
    local_files = ['job_chommie_logo.png', 'job_chommie_logo.jpg', 'logo.png', 'logo.jpg']
    input_image = None
    
    for filename in local_files:
        if os.path.exists(filename):
            print(f"Found local file: {filename}")
            input_image = Image.open(filename)
            break
    
    if input_image is None:
        # Try to use a sample image or create one
        print("No local logo file found. Creating a sample logo...")
        # Create a sample logo similar to Job Chommie style
        from PIL import ImageDraw, ImageFont
        
        # Create a new image with transparent background
        width, height = 1024, 1024
        input_image = Image.new('RGBA', (width, height), (128, 128, 128, 255))
        draw = ImageDraw.Draw(input_image)
        
        # Draw a stylized "AI" logo similar to the Job Chommie style
        # This is a placeholder - you should use the actual logo file
        draw.ellipse([width//2-150, height//2-200, width//2+150, height//2+100], 
                    fill=(255, 0, 255, 200), outline=(255, 255, 255, 255), width=5)
        
        try:
            font = ImageFont.truetype("arial.ttf", 120)
        except:
            font = ImageFont.load_default()
        
        text = "AI"
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        position = ((width - text_width) // 2, (height - text_height) // 2)
        draw.text(position, text, fill=(0, 255, 255, 255), font=font)
        
        print("Sample logo created.")
    
    print(f"\nOriginal image size: {input_image.size}")
    
    # Step 1: Remove background
    print("\nStep 1: Removing background...")
    no_bg_image = remove_background(input_image)
    no_bg_image.save('job_chommie_no_bg.png', 'PNG')
    print(" Background removed and saved as 'job_chommie_no_bg.png'")
    
    # Step 2: Upscale to 8K
    print("\nStep 2: Upscaling to 8K resolution...")
    upscaled_image, final_width, final_height = upscale_to_8k(no_bg_image)
    print(f" Upscaled to {final_width}x{final_height} pixels")
    
    # Step 3: Enhance quality
    print("\nStep 3: Enhancing image quality...")
    final_image = enhance_quality(upscaled_image)
    
    # Save the final result
    output_filename = 'job_chommie_8k_no_bg.png'
    final_image.save(output_filename, 'PNG', quality=100, optimize=False)
    print(f" Final image saved as '{output_filename}'")
    
    # Also save a compressed version for web use
    web_version = final_image.copy()
    web_version.thumbnail((1920, 1080), Image.Resampling.LANCZOS)
    web_version.save('job_chommie_web.png', 'PNG', optimize=True)
    print(f" Web-optimized version saved as 'job_chommie_web.png'")
    
    print("\n" + "=" * 50)
    print("Processing complete!")
    print(f"Final image dimensions: {final_width}x{final_height}")
    print(f"File size: {os.path.getsize(output_filename) / (1024*1024):.2f} MB")

if __name__ == "__main__":
    main()

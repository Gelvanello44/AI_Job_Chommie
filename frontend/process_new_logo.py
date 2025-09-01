import os
import numpy as np
from PIL import Image
import cv2
import requests
from io import BytesIO

def download_and_save_image(url, filename):
    """Download image from URL and save locally"""
    try:
        response = requests.get(url)
        img = Image.open(BytesIO(response.content))
        img.save(filename)
        print(f" Image saved as: {filename}")
        return True
    except:
        print("Note: Could not download from URL. Please save the image manually.")
        return False

def remove_background_advanced(image_path, output_path):
    """
    Advanced background removal for the Job Chommie logo
    Specifically tuned for cyan/pink gradient logo on gray background
    """
    # Open image
    img = Image.open(image_path)
    img = img.convert('RGBA')
    data = np.array(img)
    
    # Get RGB channels
    rgb = data[:, :, :3]
    
    # Convert to HSV for better color detection
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    
    # The logo has vibrant cyan and pink colors, background is gray
    # Extract saturation channel - logo has high saturation, background has low
    saturation = hsv[:, :, 1]
    
    # Create mask based on saturation
    # Gray background has very low saturation (< 30)
    # Logo has high saturation (> 30)
    logo_mask = saturation > 25
    
    # Also use color variance to detect logo
    b, g, r = cv2.split(rgb)
    
    # Calculate local color variance
    color_std = np.std([r, g, b], axis=0)
    color_mask = color_std > 15
    
    # Combine masks
    combined_mask = np.logical_or(logo_mask, color_mask).astype(np.uint8) * 255
    
    # Clean up the mask
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_OPEN, kernel)
    
    # Find contours
    contours, _ = cv2.findContours(combined_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if contours:
        # Get all significant contours
        significant_contours = [c for c in contours if cv2.contourArea(c) > 500]
        
        if significant_contours:
            # Create clean mask
            mask = np.zeros(combined_mask.shape, dtype=np.uint8)
            cv2.drawContours(mask, significant_contours, -1, 255, -1)
            
            # Dilate to capture glow effects
            kernel_dilate = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
            mask = cv2.dilate(mask, kernel_dilate, iterations=1)
            
            # Create smooth alpha channel with distance transform
            dist = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
            dist = cv2.normalize(dist, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
            
            # Smooth the edges
            alpha = cv2.GaussianBlur(dist, (7, 7), 2)
            
            # Apply a slight threshold to clean up very faint edges
            alpha[alpha < 10] = 0
            
            # Set alpha channel
            data[:, :, 3] = alpha
    
    # Create result image
    result = Image.fromarray(data, 'RGBA')
    
    # Save the result
    result.save(output_path, 'PNG')
    
    # Calculate transparency percentage
    alpha_channel = data[:, :, 3]
    transparent_pixels = np.sum(alpha_channel < 128)
    total_pixels = alpha_channel.size
    transparency_percent = (transparent_pixels / total_pixels) * 100
    
    return result, transparency_percent

def create_multiple_sizes(input_image, base_name="ai_logo"):
    """Create multiple sized versions of the logo"""
    sizes = [
        (4096, f'{base_name}_4K.png', '4K'),
        (2048, f'{base_name}_2K.png', '2K'),
        (1024, f'{base_name}_1K.png', '1K'),
        (512, f'{base_name}_512.png', 'Web Large'),
        (256, f'{base_name}_256.png', 'Web Medium'),
        (128, f'{base_name}_128.png', 'Icon Large'),
        (64, f'{base_name}_64.png', 'Icon Small'),
        (32, f'{base_name}_32.png', 'Favicon'),
    ]
    
    print("\n Creating multiple resolutions...")
    
    for size, filename, label in sizes:
        # Calculate dimensions maintaining aspect ratio
        width, height = input_image.size
        if width >= height:
            new_width = size
            new_height = int(size * height / width)
        else:
            new_height = size
            new_width = int(size * width / height)
        
        # Resize with high quality
        resized = input_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        resized.save(filename, 'PNG', optimize=True)
        
        # Get file size
        file_size = os.path.getsize(filename)
        if file_size > 1024*1024:
            size_str = f"{file_size/(1024*1024):.2f} MB"
        else:
            size_str = f"{file_size/1024:.2f} KB"
            
        print(f"   {label:12} -> {filename:25} [{new_width:4}x{new_height:4}] {size_str:>10}")

def create_showcase_with_backgrounds(logo_path):
    """Create showcase images with different backgrounds to verify transparency"""
    logo = Image.open(logo_path)
    
    backgrounds = [
        ('white', (255, 255, 255)),
        ('black', (0, 0, 0)),
        ('blue', (0, 100, 200)),
        ('green', (0, 200, 100)),
    ]
    
    showcase = Image.new('RGB', (logo.width * 2, logo.height * 2))
    
    for i, (name, color) in enumerate(backgrounds):
        # Create background
        bg = Image.new('RGB', logo.size, color)
        # Paste logo on background
        bg.paste(logo, (0, 0), logo)
        # Place in showcase grid
        x = (i % 2) * logo.width
        y = (i // 2) * logo.height
        showcase.paste(bg, (x, y))
    
    showcase.save('ai_logo_showcase.png', 'PNG')
    print("\n Showcase image created: ai_logo_showcase.png")

def main():
    print("="*60)
    print("AI LOGO - BACKGROUND REMOVAL PROCESSOR")
    print("="*60)
    
    # Input file (you'll need to save the image first)
    input_file = "ai_logo_original.png"
    
    # Check if file exists, if not, try common names
    if not os.path.exists(input_file):
        # Check for other possible names
        possible_names = [
            "logo.png", "logo.jpg", 
            "ai_logo.png", "ai_logo.jpg",
            "job_chommie.png", "job_chommie.jpg"
        ]
        
        found = False
        for name in possible_names:
            if os.path.exists(name):
                input_file = name
                found = True
                break
        
        if not found:
            print(f"\n Error: No image file found!")
            print(f"Please save the image as 'ai_logo_original.png' and run again.")
            return
    
    print(f"\n Processing: {input_file}")
    
    # Get image info
    original = Image.open(input_file)
    print(f"  Original size: {original.size}")
    print(f"  Original mode: {original.mode}")
    
    # Remove background
    print("\n Removing background...")
    logo_transparent, transparency = remove_background_advanced(
        input_file, 
        'ai_logo_transparent.png'
    )
    
    print(f"   Background removed: ai_logo_transparent.png")
    print(f"   Transparency: {transparency:.1f}% of image is now transparent")
    
    # Create multiple sizes
    create_multiple_sizes(logo_transparent, "ai_logo")
    
    # Create showcase
    print("\n Creating showcase images...")
    create_showcase_with_backgrounds('ai_logo_512.png')
    
    # Create checkerboard test
    print("\n Creating checkerboard test image...")
    test_logo = Image.open('ai_logo_512.png')
    checker = Image.new('RGB', test_logo.size, (255, 255, 255))
    pixels = checker.load()
    
    # Create checkerboard pattern
    square_size = 20
    for i in range(0, test_logo.width, square_size):
        for j in range(0, test_logo.height, square_size):
            if ((i // square_size) + (j // square_size)) % 2:
                for x in range(i, min(i + square_size, test_logo.width)):
                    for y in range(j, min(j + square_size, test_logo.height)):
                        pixels[x, y] = (200, 200, 200)
    
    checker.paste(test_logo, (0, 0), test_logo)
    checker.save('ai_logo_checkerboard.png', 'PNG')
    print("   Checkerboard test: ai_logo_checkerboard.png")
    
    print("\n" + "="*60)
    print(" PROCESSING COMPLETE!")
    print("="*60)
    print("\n Logo with transparent background is ready!")
    print(" Multiple sizes created for different use cases")
    print(" Showcase and test images created for verification")

if __name__ == "__main__":
    main()

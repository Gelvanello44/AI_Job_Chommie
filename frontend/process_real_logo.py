import os
import numpy as np
from PIL import Image, ImageFilter
import cv2

def remove_background_precision(image_path):
    """
    Advanced background removal specifically tuned for the Job Chommie logo
    Preserves the cyan/pink gradient while removing gray background
    """
    # Open the image
    img = Image.open(image_path).convert('RGBA')
    img_array = np.array(img)
    
    # Convert to RGB for processing
    img_rgb = img_array[:, :, :3]
    
    # Convert to HSV for better color detection
    hsv = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2HSV)
    
    # Create mask for the logo colors (cyan and pink/magenta)
    # Cyan range
    lower_cyan = np.array([80, 50, 50])
    upper_cyan = np.array([110, 255, 255])
    cyan_mask = cv2.inRange(hsv, lower_cyan, upper_cyan)
    
    # Pink/Magenta range
    lower_pink = np.array([140, 50, 50])
    upper_pink = np.array([170, 255, 255])
    pink_mask = cv2.inRange(hsv, lower_pink, upper_pink)
    
    # Also include bright white areas (for text if present)
    lower_white = np.array([0, 0, 200])
    upper_white = np.array([180, 30, 255])
    white_mask = cv2.inRange(hsv, lower_white, upper_white)
    
    # Combine all logo color masks
    logo_mask = cv2.bitwise_or(cyan_mask, pink_mask)
    logo_mask = cv2.bitwise_or(logo_mask, white_mask)
    
    # Dilate the mask to capture edges and glow effects
    kernel = np.ones((7, 7), np.uint8)
    logo_mask = cv2.dilate(logo_mask, kernel, iterations=2)
    
    # Fill holes in the mask
    contours, _ = cv2.findContours(logo_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(logo_mask, contours, -1, 255, -1)
    
    # Smooth the edges
    logo_mask = cv2.GaussianBlur(logo_mask, (9, 9), 0)
    
    # Apply threshold to create clean edges
    _, logo_mask = cv2.threshold(logo_mask, 128, 255, cv2.THRESH_BINARY)
    
    # Create edge gradient for smoother transitions
    dist_transform = cv2.distanceTransform(logo_mask, cv2.DIST_L2, 5)
    dist_transform = cv2.normalize(dist_transform, None, 0, 255, cv2.NORM_MINMAX)
    
    # Apply Gaussian blur for smooth alpha edges
    alpha_channel = cv2.GaussianBlur(dist_transform, (5, 5), 0).astype(np.uint8)
    
    # Set the alpha channel
    img_array[:, :, 3] = alpha_channel
    
    # Convert back to PIL Image
    result = Image.fromarray(img_array, 'RGBA')
    
    return result

def upscale_to_8k_maximum_quality(image, target_size=7680):
    """
    Maximum quality upscaling to 8K using multi-stage processing
    Preserves gradients and smooth edges
    """
    width, height = image.size
    aspect_ratio = width / height
    
    # Calculate target dimensions
    if width > height:
        new_width = target_size
        new_height = int(target_size / aspect_ratio)
    else:
        new_height = target_size
        new_width = int(target_size * aspect_ratio)
    
    # Ensure even dimensions
    new_width = new_width + (new_width % 2)
    new_height = new_height + (new_height % 2)
    
    print(f"Upscaling from {width}x{height} to {new_width}x{new_height}")
    
    # Convert to numpy array
    img_array = np.array(image)
    
    # Multi-stage upscaling for best quality
    stages = []
    current_size = max(width, height)
    target = max(new_width, new_height)
    
    # Calculate scaling stages (incremental scaling for better quality)
    scale = 1.0
    while current_size * scale < target:
        scale *= 1.5
        if current_size * scale > target:
            stages.append(target / current_size)
        else:
            stages.append(scale)
    
    if not stages:
        stages = [target / current_size]
    
    # Apply progressive upscaling
    current_img = img_array
    current_width, current_height = width, height
    
    for i, scale_factor in enumerate(stages):
        # Calculate next size based on current size
        stage_width = min(int(current_width * 1.5), new_width) if i < len(stages) - 1 else new_width
        stage_height = min(int(current_height * 1.5), new_height) if i < len(stages) - 1 else new_height
        
        # Ensure even dimensions
        stage_width = stage_width + (stage_width % 2)
        stage_height = stage_height + (stage_height % 2)
        
        print(f"  Stage {i+1}: Scaling to {stage_width}x{stage_height}")
        
        # Use INTER_LANCZOS4 for highest quality
        current_img = cv2.resize(current_img, (stage_width, stage_height), 
                                 interpolation=cv2.INTER_LANCZOS4)
        
        # Update current dimensions
        current_width, current_height = stage_width, stage_height
        
        # Apply mild sharpening between stages
        if i < len(stages) - 1:
            if current_img.shape[2] == 4:
                rgb = current_img[:, :, :3]
                alpha = current_img[:, :, 3]
                
                # Unsharp mask for sharpening
                gaussian = cv2.GaussianBlur(rgb, (0, 0), 2.0)
                rgb = cv2.addWeighted(rgb, 1.5, gaussian, -0.5, 0)
                
                current_img[:, :, :3] = rgb
    
    # Final resize to exact dimensions if needed
    if current_img.shape[:2] != (new_height, new_width):
        current_img = cv2.resize(current_img, (new_width, new_height), 
                                 interpolation=cv2.INTER_LANCZOS4)
    
    # Denoise while preserving edges
    if current_img.shape[2] == 4:
        rgb = current_img[:, :, :3]
        alpha = current_img[:, :, 3]
        
        # Apply bilateral filter for edge-preserving smoothing
        rgb = cv2.bilateralFilter(rgb, 9, 75, 75)
        
        current_img[:, :, :3] = rgb
    
    # Enhance colors
    if current_img.shape[2] == 4:
        rgb = current_img[:, :, :3]
        
        # Convert to LAB for better color enhancement
        lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        
        # Apply CLAHE to L channel for better contrast
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        
        # Enhance color channels slightly
        a = cv2.add(a, 5)  # Enhance green-red
        b = cv2.add(b, 5)  # Enhance blue-yellow
        
        # Merge and convert back
        lab = cv2.merge([l, a, b])
        rgb = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)
        
        current_img[:, :, :3] = rgb
    
    # Convert back to PIL
    result = Image.fromarray(current_img, 'RGBA' if current_img.shape[2] == 4 else 'RGB')
    
    return result, new_width, new_height

def main():
    print("="*70)
    print("JOB CHOMMIE LOGO - ULTRA HD 8K PROCESSOR")
    print("="*70)
    
    input_file = "job_chommie_logo_original.png"
    
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found!")
        return
    
    print(f"\n Loading: {input_file}")
    
    # Load and display original info
    original = Image.open(input_file)
    print(f" Original dimensions: {original.size}")
    print(f" Original mode: {original.mode}")
    
    # Step 1: Remove background
    print("\n Step 1: Removing background with precision algorithm...")
    no_bg_image = remove_background_precision(input_file)
    no_bg_image.save('job_chommie_clean.png', 'PNG')
    print(" Background removed: job_chommie_clean.png")
    
    # Step 2: Upscale to 8K
    print("\n Step 2: Upscaling to 8K resolution...")
    upscaled_8k, width_8k, height_8k = upscale_to_8k_maximum_quality(no_bg_image, 7680)
    
    # Save 8K version
    print(f"\n Saving 8K version ({width_8k}x{height_8k})...")
    upscaled_8k.save('job_chommie_8K_ULTRA.png', 'PNG', optimize=False, compress_level=0)
    
    # Create additional versions
    print("\n Creating optimized versions...")
    
    # 4K version
    img_4k = upscaled_8k.copy()
    img_4k.thumbnail((3840, 3840), Image.Resampling.LANCZOS)
    img_4k.save('job_chommie_4K.png', 'PNG', optimize=True)
    print(f" 4K version: {img_4k.size}")
    
    # 2K version
    img_2k = upscaled_8k.copy()
    img_2k.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
    img_2k.save('job_chommie_2K.png', 'PNG', optimize=True)
    print(f" 2K version: {img_2k.size}")
    
    # Full HD version
    img_fhd = upscaled_8k.copy()
    img_fhd.thumbnail((1920, 1920), Image.Resampling.LANCZOS)
    img_fhd.save('job_chommie_FHD.png', 'PNG', optimize=True)
    print(f" Full HD version: {img_fhd.size}")
    
    # Web version
    img_web = upscaled_8k.copy()
    img_web.thumbnail((512, 512), Image.Resampling.LANCZOS)
    img_web.save('job_chommie_WEB.png', 'PNG', optimize=True)
    print(f" Web version: {img_web.size}")
    
    # Icon version
    img_icon = upscaled_8k.copy()
    img_icon.thumbnail((256, 256), Image.Resampling.LANCZOS)
    img_icon.save('job_chommie_ICON.png', 'PNG', optimize=True)
    print(f" Icon version: {img_icon.size}")
    
    # Print summary
    print("\n" + "="*70)
    print(" PROCESSING COMPLETE!")
    print("="*70)
    
    files = [
        ('job_chommie_8K_ULTRA.png', '8K Ultra HD'),
        ('job_chommie_4K.png', '4K'),
        ('job_chommie_2K.png', '2K'),
        ('job_chommie_FHD.png', 'Full HD'),
        ('job_chommie_WEB.png', 'Web'),
        ('job_chommie_ICON.png', 'Icon'),
    ]
    
    print("\n FILE SUMMARY:")
    print("-"*50)
    for filename, label in files:
        if os.path.exists(filename):
            size = os.path.getsize(filename)
            img = Image.open(filename)
            if size > 1024*1024:
                size_str = f"{size/(1024*1024):.2f} MB"
            else:
                size_str = f"{size/1024:.2f} KB"
            print(f"{label:12} | {img.size[0]:5}x{img.size[1]:5} | {size_str:>10}")
    
    print("\n All files have transparent backgrounds and maximum quality!")

if __name__ == "__main__":
    main()

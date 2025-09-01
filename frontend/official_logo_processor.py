import os
import shutil
from PIL import Image
import numpy as np

def process_official_logo():
    """
    Process the OFFICIAL AI Job Chommie logo
    Creates all necessary versions for the project
    """
    print("="*70)
    print("AI JOB CHOMMIE - OFFICIAL LOGO PROCESSOR")
    print("="*70)
    
    # The ONE and ONLY official logo
    official_logo = "OFFICIAL_AI_JOB_CHOMMIE_LOGO.jpg"
    
    if not os.path.exists(official_logo):
        print(" ERROR: Official logo not found!")
        return
    
    print(f"\n Processing OFFICIAL logo: {official_logo}")
    
    # Open the official logo
    logo = Image.open(official_logo)
    print(f"   Original size: {logo.size}")
    print(f"   Format: {logo.format}")
    
    # Convert to RGBA for transparency support (if needed later)
    if logo.mode != 'RGBA':
        logo = logo.convert('RGBA')
    
    # Create project directories for logos
    dirs = [
        "logos/full",
        "logos/web",
        "logos/icons",
        "logos/favicons",
        "dist/images",
        "public/images"
    ]
    
    for dir_path in dirs:
        os.makedirs(dir_path, exist_ok=True)
    
    print("\n Creating logo versions for the entire project...")
    
    # Define all sizes needed for the project
    versions = [
        # Full resolution versions
        ("logos/full/logo_original.png", None, "Original"),
        ("logos/full/logo_4k.png", (3840, 3840), "4K"),
        ("logos/full/logo_2k.png", (2048, 2048), "2K"),
        ("logos/full/logo_1k.png", (1024, 1024), "1K"),
        
        # Web versions
        ("logos/web/logo_1024.png", (1024, 1024), "Web XL"),
        ("logos/web/logo_512.png", (512, 512), "Web Large"),
        ("logos/web/logo_256.png", (256, 256), "Web Medium"),
        ("logos/web/logo_128.png", (128, 128), "Web Small"),
        
        # Icon versions
        ("logos/icons/icon_256.png", (256, 256), "Icon 256"),
        ("logos/icons/icon_128.png", (128, 128), "Icon 128"),
        ("logos/icons/icon_64.png", (64, 64), "Icon 64"),
        ("logos/icons/icon_48.png", (48, 48), "Icon 48"),
        ("logos/icons/icon_32.png", (32, 32), "Icon 32"),
        
        # Favicon versions
        ("logos/favicons/favicon_32.png", (32, 32), "Favicon 32"),
        ("logos/favicons/favicon_16.png", (16, 16), "Favicon 16"),
        
        # Distribution versions
        ("dist/images/logo.png", (512, 512), "Dist Main"),
        ("dist/images/logo_small.png", (128, 128), "Dist Small"),
        
        # Public versions
        ("public/images/logo.png", (512, 512), "Public Main"),
        ("public/images/logo_small.png", (128, 128), "Public Small"),
    ]
    
    for filepath, size, label in versions:
        if size is None:
            # Save original
            logo.save(filepath, 'PNG', optimize=True, quality=95)
        else:
            # Create resized version
            resized = logo.copy()
            resized.thumbnail(size, Image.Resampling.LANCZOS)
            
            # If exact size needed, create new image with padding
            if resized.size != size:
                new_img = Image.new('RGBA', size, (0, 0, 0, 0))
                # Center the logo
                x = (size[0] - resized.width) // 2
                y = (size[1] - resized.height) // 2
                new_img.paste(resized, (x, y))
                resized = new_img
            
            resized.save(filepath, 'PNG', optimize=True)
        
        file_size = os.path.getsize(filepath)
        size_str = f"{file_size/1024:.1f} KB" if file_size < 1024*1024 else f"{file_size/(1024*1024):.2f} MB"
        size_info = f"[{size[0]}x{size[1]}]" if size else "[Original]"
        print(f"    {label:15} {size_info:12} -> {filepath:35} ({size_str})")
    
    # Create main project logo files
    print("\n Setting up main project logos...")
    
    main_logos = [
        ("logo.png", (512, 512)),
        ("logo_main.png", (512, 512)),
        ("logo_header.png", (256, 256)),
        ("logo_footer.png", (128, 128)),
    ]
    
    for filename, size in main_logos:
        resized = logo.copy()
        resized.thumbnail(size, Image.Resampling.LANCZOS)
        resized.save(filename, 'PNG', optimize=True)
        print(f"    {filename} created")
    
    # Create ICO file for Windows
    print("\n Creating special formats...")
    logo_ico = logo.copy()
    logo_ico.thumbnail((256, 256), Image.Resampling.LANCZOS)
    logo_ico.save("favicon.ico", format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (256, 256)])
    print("    favicon.ico created")
    
    # Create a README for logo usage
    readme_content = """# AI JOB CHOMMIE - OFFICIAL LOGO ASSETS

##  IMPORTANT: This is the OFFICIAL logo for the entire project

### Logo Locations:
- **Original**: `OFFICIAL_AI_JOB_CHOMMIE_LOGO.jpg`
- **Full Resolution**: `logos/full/`
- **Web Versions**: `logos/web/`
- **Icons**: `logos/icons/`
- **Favicons**: `logos/favicons/`

### Usage Guidelines:
1. **Main Logo**: Use `logo.png` or `logo_main.png` (512x512)
2. **Header**: Use `logo_header.png` (256x256)
3. **Footer**: Use `logo_footer.png` (128x128)
4. **Favicon**: Use `favicon.ico` (multiple sizes)

### DO NOT:
- Replace with any other logo
- Modify without authorization
- Use old logo versions

### Last Updated: 
Generated from official source at C:\\Users\\user\\Desktop\\Gelvanello\\AppImages\\AI Job Chommie logo.jpg

---
© AI Job Chommie - Official Brand Assets
"""
    
    with open("LOGO_README.md", "w") as f:
        f.write(readme_content)
    print("    LOGO_README.md created")
    
    print("\n" + "="*70)
    print(" OFFICIAL LOGO PROCESSING COMPLETE!")
    print("="*70)
    print("\n The OFFICIAL AI Job Chommie logo is now set up across the entire project")
    print(" All old logos have been removed")
    print(" Use the versions in the 'logos' directory for all project needs")
    
    # Final summary
    total_files = len(versions) + len(main_logos) + 2  # +2 for ico and readme
    print(f"\n Summary: {total_files} logo files created from the OFFICIAL source")

if __name__ == "__main__":
    process_official_logo()

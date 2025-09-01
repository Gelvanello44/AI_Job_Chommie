"""
Browser fingerprint generator for anti-detection.
Generates realistic browser fingerprints to avoid detection.
"""

import random
import json
from typing import Dict, List, Any, Tuple
from datetime import datetime, timezone
import hashlib

from fake_useragent import UserAgent


class FingerprintGenerator:
    """Generate realistic browser fingerprints."""
    
    def __init__(self):
        self.ua = UserAgent()
        
        # Common screen resolutions
        self.screen_resolutions = [
            (1920, 1080), (1366, 768), (1440, 900), (1536, 864),
            (1600, 900), (1280, 720), (1280, 800), (1280, 1024),
            (2560, 1440), (3840, 2160), (1680, 1050), (1024, 768)
        ]
        
        # Common color depths
        self.color_depths = [24, 32]
        
        # Common languages
        self.languages = [
            ['en-US', 'en'],
            ['en-GB', 'en'],
            ['en-US', 'en', 'fr'],
            ['en-US', 'en', 'es'],
            ['en-US', 'en', 'de'],
            ['en-ZA', 'en'],
            ['en-AU', 'en']
        ]
        
        # Common timezones for South Africa and major cities
        self.timezones = [
            'Africa/Johannesburg',
            'Africa/Cape_Town',
            'Africa/Durban',
            'Europe/London',
            'America/New_York',
            'Europe/Berlin'
        ]
        
        # Canvas fingerprint components
        self.canvas_texts = [
            "BrowserLeaks,com <canvas> 1.0",
            "Mozilla/5.0 Canvas Test",
            "HTML5 Canvas Element"
        ]
        
        # WebGL vendor/renderer pairs
        self.webgl_pairs = [
            ("Intel Inc.", "Intel Iris OpenGL Engine"),
            ("NVIDIA Corporation", "GeForce GTX 1060/PCIe/SSE2"),
            ("NVIDIA Corporation", "GeForce GTX 1070/PCIe/SSE2"),
            ("NVIDIA Corporation", "GeForce RTX 2060/PCIe/SSE2"),
            ("ATI Technologies Inc.", "AMD Radeon Pro 5500M OpenGL Engine"),
            ("Google Inc.", "ANGLE (NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0)"),
            ("Google Inc.", "ANGLE (Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)")
        ]
        
        # Font lists by OS
        self.fonts = {
            'windows': [
                'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Cambria Math',
                'Comic Sans MS', 'Consolas', 'Courier', 'Courier New',
                'Georgia', 'Helvetica', 'Impact', 'Lucida Console',
                'MS Sans Serif', 'MS Serif', 'Palatino Linotype', 'Segoe UI',
                'Tahoma', 'Times', 'Times New Roman', 'Trebuchet MS', 'Verdana'
            ],
            'macos': [
                'American Typewriter', 'Andale Mono', 'Arial', 'Arial Black',
                'Arial Narrow', 'Arial Rounded MT Bold', 'Arial Unicode MS',
                'Avenir', 'Avenir Next', 'Avenir Next Condensed', 'Baskerville',
                'Big Caslon', 'Bodoni 72', 'Bradley Hand', 'Calibri', 'Cambria',
                'Cochin', 'Comic Sans MS', 'Copperplate', 'Courier', 'Courier New',
                'Didot', 'Futura', 'Geneva', 'Georgia', 'Gill Sans', 'Helvetica',
                'Helvetica Neue', 'Herculanum', 'Hoefler Text', 'Impact',
                'Lucida Grande', 'Luminari', 'Marker Felt', 'Menlo', 'Monaco',
                'Optima', 'Palatino', 'Papyrus', 'Phosphate', 'Rockwell',
                'SF Pro Display', 'SF Pro Text', 'Savoye LET', 'SignPainter',
                'Silom', 'Skia', 'Snell Roundhand', 'Tahoma', 'Times',
                'Times New Roman', 'Trattatello', 'Trebuchet MS', 'Verdana'
            ],
            'linux': [
                'Bitstream Vera Sans', 'Bitstream Vera Sans Mono',
                'Bitstream Vera Serif', 'DejaVu Sans', 'DejaVu Sans Mono',
                'DejaVu Serif', 'FreeMono', 'FreeSans', 'FreeSerif',
                'Liberation Mono', 'Liberation Sans', 'Liberation Serif',
                'Nimbus Mono L', 'Nimbus Roman No9 L', 'Nimbus Sans L',
                'Ubuntu', 'Ubuntu Condensed', 'Ubuntu Mono'
            ]
        }
        
        # Plugin configurations
        self.plugin_configs = [
            [],  # No plugins (common)
            [
                {'name': 'Chrome PDF Plugin', 'filename': 'internal-pdf-viewer'},
                {'name': 'Chrome PDF Viewer', 'filename': 'mhjfbmdgcfjbbpaeojofohoefgiehjai'},
                {'name': 'Native Client', 'filename': 'internal-nacl-plugin'}
            ],
            [
                {'name': 'Microsoft Edge PDF Plugin', 'filename': 'internal-pdf-viewer'},
                {'name': 'Microsoft Edge PDF Viewer', 'filename': 'edge-pdf'}
            ]
        ]
        
    def generate(self) -> Dict[str, Any]:
        """Generate a complete browser fingerprint."""
        # Determine OS based on user agent
        user_agent = self.ua.random
        os_type = self._detect_os(user_agent)
        
        # Get screen resolution
        screen_width, screen_height = random.choice(self.screen_resolutions)
        
        # Calculate available screen (account for taskbar)
        avail_height = screen_height - random.randint(40, 80) if os_type == 'windows' else screen_height
        
        fingerprint = {
            # User Agent
            'user_agent': user_agent,
            
            # Screen properties
            'screen_width': screen_width,
            'screen_height': screen_height,
            'screen_avail_width': screen_width,
            'screen_avail_height': avail_height,
            'screen_color_depth': random.choice(self.color_depths),
            'screen_pixel_depth': random.choice(self.color_depths),
            
            # Window properties
            'window_outer_width': screen_width,
            'window_outer_height': avail_height,
            'window_inner_width': screen_width - random.randint(0, 16),
            'window_inner_height': avail_height - random.randint(60, 120),
            
            # Device properties
            'device_pixel_ratio': random.choice([1, 1.25, 1.5, 2]),
            'hardware_concurrency': random.choice([2, 4, 6, 8, 12, 16]),
            'max_touch_points': 0 if os_type == 'desktop' else random.choice([1, 5, 10]),
            
            # Language and timezone
            'languages': random.choice(self.languages),
            'language': random.choice(self.languages)[0],
            'timezone': random.choice(self.timezones),
            'timezone_offset': self._get_timezone_offset(),
            
            # Platform info
            'platform': self._get_platform(os_type, user_agent),
            'os_cpu': self._get_os_cpu(os_type),
            
            # Plugins
            'plugins': random.choice(self.plugin_configs),
            
            # WebGL
            'webgl_vendor': None,
            'webgl_renderer': None,
            
            # Canvas fingerprint
            'canvas_fingerprint': self._generate_canvas_fingerprint(),
            
            # Fonts
            'fonts': self._get_font_list(os_type),
            
            # Audio fingerprint
            'audio_fingerprint': self._generate_audio_fingerprint(),
            
            # Media devices
            'media_devices': self._generate_media_devices(),
            
            # Battery API
            'battery_charging': random.choice([True, False, None]),
            'battery_level': random.choice([None, round(random.uniform(0.1, 1.0), 2)]),
            
            # Network information
            'connection_type': random.choice(['wifi', '4g', 'ethernet', None]),
            'effective_type': random.choice(['4g', '3g', '2g', 'slow-2g']),
            
            # Do Not Track
            'do_not_track': random.choice(['1', None]),
            
            # Cookies enabled
            'cookies_enabled': True,
            
            # Local storage
            'local_storage': True,
            'session_storage': True,
            'indexed_db': True,
            
            # WebRTC
            'webrtc_enabled': random.choice([True, False]),
            
            # Ad blocker detection
            'ad_blocker': random.choice([True, False]),
            
            # TLS fingerprint components
            'tls_version': random.choice(['TLS 1.2', 'TLS 1.3']),
            'cipher_suites': self._get_cipher_suites(),
            
            # HTTP headers order (for curl-cffi)
            'header_order': self._get_header_order(),
            
            # Browser-specific features
            'chrome_features': self._get_chrome_features() if 'Chrome' in user_agent else {},
            
            # Timestamp
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        # Add WebGL if supported
        if random.random() > 0.1:  # 90% have WebGL
            vendor, renderer = random.choice(self.webgl_pairs)
            fingerprint['webgl_vendor'] = vendor
            fingerprint['webgl_renderer'] = renderer
        
        return fingerprint
    
    def _detect_os(self, user_agent: str) -> str:
        """Detect OS from user agent."""
        ua_lower = user_agent.lower()
        if 'windows' in ua_lower:
            return 'windows'
        elif 'mac os' in ua_lower or 'macintosh' in ua_lower:
            return 'macos'
        elif 'linux' in ua_lower:
            return 'linux'
        elif 'android' in ua_lower:
            return 'android'
        elif 'iphone' in ua_lower or 'ipad' in ua_lower:
            return 'ios'
        return 'unknown'
    
    def _get_platform(self, os_type: str, user_agent: str) -> str:
        """Get platform string."""
        if os_type == 'windows':
            if '64' in user_agent:
                return 'Win32'  # Yes, even on 64-bit
            return 'Win32'
        elif os_type == 'macos':
            return 'MacIntel'
        elif os_type == 'linux':
            if '64' in user_agent:
                return 'Linux x86_64'
            return 'Linux i686'
        elif os_type == 'android':
            return 'Linux armv7l'
        elif os_type == 'ios':
            return 'iPhone'
        return 'Unknown'
    
    def _get_os_cpu(self, os_type: str) -> str:
        """Get OS CPU string."""
        if os_type == 'windows':
            return random.choice(['', 'Windows NT 10.0; Win64; x64'])
        elif os_type == 'macos':
            return 'Intel Mac OS X'
        elif os_type == 'linux':
            return 'Linux x86_64'
        return ''
    
    def _get_timezone_offset(self) -> int:
        """Get timezone offset in minutes."""
        # South Africa is UTC+2
        return -120
    
    def _generate_canvas_fingerprint(self) -> str:
        """Generate canvas fingerprint hash."""
        text = random.choice(self.canvas_texts)
        # Create a pseudo-random but deterministic hash
        base = f"{text}-{random.randint(1000000, 9999999)}"
        return hashlib.md5(base.encode()).hexdigest()
    
    def _get_font_list(self, os_type: str) -> List[str]:
        """Get font list for OS."""
        if os_type in self.fonts:
            all_fonts = self.fonts[os_type]
            # Return a random subset
            num_fonts = random.randint(len(all_fonts) // 2, len(all_fonts))
            return random.sample(all_fonts, num_fonts)
        return []
    
    def _generate_audio_fingerprint(self) -> float:
        """Generate audio context fingerprint."""
        # Simulate audio context fingerprint values
        return round(random.uniform(0.00001, 0.00009), 8)
    
    def _generate_media_devices(self) -> List[Dict[str, str]]:
        """Generate media devices list."""
        devices = []
        
        # Most systems have at least one audio input/output
        devices.append({
            'kind': 'audioinput',
            'label': '',
            'deviceId': hashlib.md5(f"audioinput{random.randint(1, 1000)}".encode()).hexdigest()[:16]
        })
        
        devices.append({
            'kind': 'audiooutput',
            'label': '',
            'deviceId': hashlib.md5(f"audiooutput{random.randint(1, 1000)}".encode()).hexdigest()[:16]
        })
        
        # Maybe add video input
        if random.random() > 0.3:  # 70% have webcam
            devices.append({
                'kind': 'videoinput',
                'label': '',
                'deviceId': hashlib.md5(f"videoinput{random.randint(1, 1000)}".encode()).hexdigest()[:16]
            })
        
        return devices
    
    def _get_cipher_suites(self) -> List[str]:
        """Get TLS cipher suites."""
        # Common Chrome cipher suites
        chrome_ciphers = [
            "TLS_AES_128_GCM_SHA256",
            "TLS_AES_256_GCM_SHA384",
            "TLS_CHACHA20_POLY1305_SHA256",
            "ECDHE-ECDSA-AES128-GCM-SHA256",
            "ECDHE-RSA-AES128-GCM-SHA256",
            "ECDHE-ECDSA-AES256-GCM-SHA384",
            "ECDHE-RSA-AES256-GCM-SHA384",
            "ECDHE-ECDSA-CHACHA20-POLY1305",
            "ECDHE-RSA-CHACHA20-POLY1305",
            "ECDHE-RSA-AES128-SHA",
            "ECDHE-RSA-AES256-SHA",
            "AES128-GCM-SHA256",
            "AES256-GCM-SHA384",
            "AES128-SHA",
            "AES256-SHA"
        ]
        
        # Return a subset in order
        num_ciphers = random.randint(10, len(chrome_ciphers))
        return chrome_ciphers[:num_ciphers]
    
    def _get_header_order(self) -> List[str]:
        """Get HTTP header order for requests."""
        # Common Chrome header order
        return [
            "host",
            "connection",
            "cache-control",
            "sec-ch-ua",
            "sec-ch-ua-mobile",
            "sec-ch-ua-platform",
            "upgrade-insecure-requests",
            "user-agent",
            "accept",
            "sec-fetch-site",
            "sec-fetch-mode",
            "sec-fetch-user",
            "sec-fetch-dest",
            "accept-encoding",
            "accept-language"
        ]
    
    def _get_chrome_features(self) -> Dict[str, Any]:
        """Get Chrome-specific features."""
        return {
            'app_version': f"5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{random.randint(96, 120)}.0.0.0 Safari/537.36",
            'vendor': 'Google Inc.',
            'product': 'Gecko',
            'product_sub': '20030107',
            'build_id': '',
            'chrome': True,
            'pdf_viewer_enabled': True,
            'webdriver': False,
            'credentials_enable': True,
            'app_codec': 'video/mp4; codecs="avc1.42E01E"',
            'permissions': {
                'geolocation': 'prompt',
                'notifications': 'prompt',
                'media_devices': 'prompt',
                'camera': 'prompt',
                'microphone': 'prompt'
            }
        }
    
    def mutate_fingerprint(self, fingerprint: Dict[str, Any], mutation_rate: float = 0.1) -> Dict[str, Any]:
        """Create a slightly mutated version of a fingerprint."""
        mutated = fingerprint.copy()
        
        # Properties that can be mutated
        mutable_props = [
            'window_inner_width', 'window_inner_height',
            'battery_level', 'battery_charging',
            'connection_type', 'effective_type',
            'canvas_fingerprint', 'audio_fingerprint'
        ]
        
        for prop in mutable_props:
            if prop in mutated and random.random() < mutation_rate:
                if prop == 'canvas_fingerprint':
                    mutated[prop] = self._generate_canvas_fingerprint()
                elif prop == 'audio_fingerprint':
                    mutated[prop] = self._generate_audio_fingerprint()
                elif prop == 'battery_level' and mutated[prop] is not None:
                    mutated[prop] = round(random.uniform(0.1, 1.0), 2)
                elif prop == 'battery_charging' and mutated[prop] is not None:
                    mutated[prop] = not mutated[prop]
                elif prop in ['window_inner_width', 'window_inner_height']:
                    mutated[prop] += random.randint(-10, 10)
                elif prop == 'connection_type':
                    mutated[prop] = random.choice(['wifi', '4g', 'ethernet', None])
                elif prop == 'effective_type':
                    mutated[prop] = random.choice(['4g', '3g', '2g', 'slow-2g'])
        
        # Update timestamp
        mutated['timestamp'] = datetime.now(timezone.utc).isoformat()
        
        return mutated

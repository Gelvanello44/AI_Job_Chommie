"""
CAPTCHA solver integration for handling anti-bot measures.
"""

import asyncio
import base64
import time
import random
from typing import Dict, Any, Optional
from datetime import datetime
import aiohttp
from loguru import logger
from playwright.async_api import Page

from src.config.settings import settings


class CaptchaSolver:
    """CAPTCHA solver integration with multiple providers."""
    
    def __init__(self):
        self.api_key = settings.captcha_solver_api_key
        self.api_url = "https://api.2captcha.com"  # Default provider
        self.timeout = 120  # 2 minutes timeout
        self.poll_interval = 5  # Check every 5 seconds
        
        # Statistics
        self.solved_count = 0
        self.failed_count = 0
        self.total_solve_time = 0
    
    async def solve(self, page: Page) -> bool:
        """Solve CAPTCHA on the current page."""
        try:
            # Detect CAPTCHA type
            captcha_type = await self._detect_captcha_type(page)
            
            if captcha_type == "recaptcha_v2":
                return await self._solve_recaptcha_v2(page)
            elif captcha_type == "recaptcha_v3":
                return await self._solve_recaptcha_v3(page)
            elif captcha_type == "image":
                return await self._solve_image_captcha(page)
            elif captcha_type == "text":
                return await self._solve_text_captcha(page)
            else:
                logger.warning("Unknown CAPTCHA type detected")
                return False
        
        except Exception as e:
            logger.error(f"CAPTCHA solving failed: {e}")
            self.failed_count += 1
            return False
    
    async def _detect_captcha_type(self, page: Page) -> Optional[str]:
        """Detect the type of CAPTCHA on the page."""
        # Check for reCAPTCHA v2
        if await page.query_selector('iframe[src*="recaptcha"]'):
            return "recaptcha_v2"
        
        # Check for reCAPTCHA v3 (usually invisible)
        if await page.query_selector('[data-sitekey]'):
            return "recaptcha_v3"
        
        # Check for image CAPTCHA
        if await page.query_selector('img[alt*="captcha" i], img[src*="captcha" i]'):
            return "image"
        
        # Check for text CAPTCHA
        if await page.query_selector('input[name*="captcha" i], input[id*="captcha" i]'):
            return "text"
        
        return None
    
    async def _solve_recaptcha_v2(self, page: Page) -> bool:
        """Solve reCAPTCHA v2."""
        if not self.api_key:
            logger.warning("No CAPTCHA API key configured")
            return False
        
        try:
            start_time = time.time()
            
            # Get site key
            site_key_elem = await page.query_selector('[data-sitekey]')
            if not site_key_elem:
                return False
            
            site_key = await site_key_elem.get_attribute('data-sitekey')
            page_url = page.url
            
            # Submit CAPTCHA to solving service
            captcha_id = await self._submit_recaptcha(site_key, page_url)
            if not captcha_id:
                return False
            
            # Wait for solution
            solution = await self._get_captcha_solution(captcha_id)
            if not solution:
                return False
            
            # Inject solution into page
            await page.evaluate(f"""
                document.getElementById('g-recaptcha-response').innerHTML = '{solution}';
                if (window.grecaptcha) {{
                    window.grecaptcha.getResponse = function() {{ return '{solution}'; }};
                }}
            """)
            
            # Submit form or trigger validation
            submit_button = await page.query_selector('input[type="submit"], button[type="submit"]')
            if submit_button:
                await submit_button.click()
            
            solve_time = time.time() - start_time
            self.solved_count += 1
            self.total_solve_time += solve_time
            
            logger.info(f"reCAPTCHA v2 solved in {solve_time:.2f}s")
            return True
        
        except Exception as e:
            logger.error(f"reCAPTCHA v2 solving failed: {e}")
            return False
    
    async def _solve_recaptcha_v3(self, page: Page) -> bool:
        """Solve reCAPTCHA v3 (usually requires different approach)."""
        logger.info("reCAPTCHA v3 detected - using behavioral approach")
        
        try:
            # For reCAPTCHA v3, we primarily rely on behavioral mimicking
            # and fingerprint management rather than external solving services
            
            # Perform human-like actions
            await self._perform_human_actions(page)
            
            # Wait and see if CAPTCHA clears
            await asyncio.sleep(2)
            
            # Check if CAPTCHA is still present
            captcha_present = await page.query_selector('iframe[src*="recaptcha"]')
            
            if not captcha_present:
                logger.info("reCAPTCHA v3 passed with behavioral approach")
                return True
            
            return False
        
        except Exception as e:
            logger.error(f"reCAPTCHA v3 handling failed: {e}")
            return False
    
    async def _solve_image_captcha(self, page: Page) -> bool:
        """Solve image-based CAPTCHA."""
        if not self.api_key:
            return False
        
        try:
            # Find CAPTCHA image
            img_elem = await page.query_selector('img[alt*="captcha" i], img[src*="captcha" i]')
            if not img_elem:
                return False
            
            # Get image data
            img_src = await img_elem.get_attribute('src')
            if img_src.startswith('data:'):
                # Base64 encoded image
                image_data = img_src.split(',')[1]
            else:
                # Download image
                image_data = await self._download_image_as_base64(page, img_src)
            
            if not image_data:
                return False
            
            # Submit to solving service
            captcha_id = await self._submit_image_captcha(image_data)
            if not captcha_id:
                return False
            
            # Get solution
            solution = await self._get_captcha_solution(captcha_id)
            if not solution:
                return False
            
            # Enter solution
            input_elem = await page.query_selector('input[name*="captcha" i], input[id*="captcha" i]')
            if input_elem:
                await input_elem.fill(solution)
                
                # Submit
                await page.keyboard.press('Enter')
                
                self.solved_count += 1
                logger.info("Image CAPTCHA solved")
                return True
        
        except Exception as e:
            logger.error(f"Image CAPTCHA solving failed: {e}")
        
        return False
    
    async def _solve_text_captcha(self, page: Page) -> bool:
        """Solve text-based CAPTCHA."""
        # Text CAPTCHAs are usually simple math or word problems
        try:
            # Find CAPTCHA question
            question_elem = await page.query_selector('.captcha-question, [class*="captcha"] span, [id*="captcha"] span')
            if not question_elem:
                return False
            
            question_text = await question_elem.inner_text()
            
            # Simple math CAPTCHA solver
            solution = self._solve_math_captcha(question_text)
            
            if solution:
                input_elem = await page.query_selector('input[name*="captcha" i], input[id*="captcha" i]')
                if input_elem:
                    await input_elem.fill(str(solution))
                    await page.keyboard.press('Enter')
                    
                    self.solved_count += 1
                    logger.info(f"Text CAPTCHA solved: {question_text} = {solution}")
                    return True
        
        except Exception as e:
            logger.error(f"Text CAPTCHA solving failed: {e}")
        
        return False
    
    def _solve_math_captcha(self, question: str) -> Optional[int]:
        """Solve simple math CAPTCHA."""
        import re
        
        # Look for simple math expressions
        # Example: "What is 5 + 3?"
        math_pattern = r'(\d+)\s*([+\-*/])\s*(\d+)'
        match = re.search(math_pattern, question)
        
        if match:
            try:
                num1 = int(match.group(1))
                operator = match.group(2)
                num2 = int(match.group(3))
                
                if operator == '+':
                    return num1 + num2
                elif operator == '-':
                    return num1 - num2
                elif operator == '*':
                    return num1 * num2
                elif operator == '/':
                    return num1 // num2 if num2 != 0 else None
            
            except (ValueError, ZeroDivisionError):
                pass
        
        return None
    
    async def _submit_recaptcha(self, site_key: str, page_url: str) -> Optional[str]:
        """Submit reCAPTCHA to solving service."""
        data = {
            'key': self.api_key,
            'method': 'userrecaptcha',
            'googlekey': site_key,
            'pageurl': page_url,
            'json': 1
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{self.api_url}/in.php", data=data) as response:
                result = await response.json()
                
                if result.get('status') == 1:
                    return result.get('request')
        
        return None
    
    async def _submit_image_captcha(self, image_data: str) -> Optional[str]:
        """Submit image CAPTCHA to solving service."""
        data = {
            'key': self.api_key,
            'method': 'base64',
            'body': image_data,
            'json': 1
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{self.api_url}/in.php", data=data) as response:
                result = await response.json()
                
                if result.get('status') == 1:
                    return result.get('request')
        
        return None
    
    async def _get_captcha_solution(self, captcha_id: str) -> Optional[str]:
        """Get CAPTCHA solution from solving service."""
        start_time = time.time()
        
        while time.time() - start_time < self.timeout:
            await asyncio.sleep(self.poll_interval)
            
            params = {
                'key': self.api_key,
                'action': 'get',
                'id': captcha_id,
                'json': 1
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.api_url}/res.php", params=params) as response:
                    result = await response.json()
                    
                    if result.get('status') == 1:
                        return result.get('request')
                    elif result.get('error_text') == 'CAPCHA_NOT_READY':
                        continue
                    else:
                        logger.error(f"CAPTCHA solving error: {result.get('error_text')}")
                        return None
        
        logger.error("CAPTCHA solving timeout")
        return None
    
    async def _download_image_as_base64(self, page: Page, img_src: str) -> Optional[str]:
        """Download image and convert to base64."""
        try:
            # Handle relative URLs
            if img_src.startswith('/'):
                img_src = f"{page.url.split('/')[0]}//{page.url.split('/')[2]}{img_src}"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(img_src) as response:
                    if response.status == 200:
                        image_bytes = await response.read()
                        return base64.b64encode(image_bytes).decode('utf-8')
        
        except Exception as e:
            logger.error(f"Failed to download CAPTCHA image: {e}")
        
        return None
    
    async def _perform_human_actions(self, page: Page):
        """Perform human-like actions to improve CAPTCHA success rate."""
        # Random mouse movements
        for _ in range(3):
            x = random.randint(100, 800)
            y = random.randint(100, 600)
            await page.mouse.move(x, y)
            await asyncio.sleep(random.uniform(0.1, 0.3))
        
        # Random scrolling
        await page.evaluate("window.scrollBy(0, 100)")
        await asyncio.sleep(random.uniform(0.5, 1.0))
        
        # Wait a bit
        await asyncio.sleep(random.uniform(1.0, 3.0))
    
    def get_stats(self) -> Dict[str, Any]:
        """Get CAPTCHA solver statistics."""
        total_attempts = self.solved_count + self.failed_count
        
        return {
            "solved_count": self.solved_count,
            "failed_count": self.failed_count,
            "total_attempts": total_attempts,
            "success_rate": self.solved_count / max(total_attempts, 1),
            "average_solve_time": self.total_solve_time / max(self.solved_count, 1),
            "api_configured": bool(self.api_key)
        }

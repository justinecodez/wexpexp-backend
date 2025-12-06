import os
import re
import json
import uuid

# Configuration
PROJECT_ROOT = '/Users/justinemahinyila/Codez/wexp/wexp-backend'
ROUTES_DIR = os.path.join(PROJECT_ROOT, 'src/routes')
OUTPUT_FILE = os.path.join(PROJECT_ROOT, 'wexp_postman_collection.json')

# Base path mapping
BASE_PATHS = {
    'auth.ts': '/api/auth',
    'events.ts': '/api/events',
    'invitations.ts': '/api/invitations',
    'tours.ts': '/api/tours',
    'vehicles.ts': '/api/vehicles',
    'accommodations.ts': '/api/accommodations',
    'test.ts': '/api/test',
    'templates.ts': '/api/templates',
    'budgets.ts': '/api/budgets',
    'calendar.ts': '/api/calendar',
    'drafts.ts': '/api/drafts',
    'users.ts': '/api/users',
    'ecards.ts': '/api/ecards',
    'venues.ts': '/api/venues',
    'decorations.ts': '/api/decorations',
    'car-import.ts': '/api/car-import',
    'insurance.ts': '/api/insurance',
    'landing.ts': '/api/landing',
    'communications.ts': '/api/communications',
    'messagingRoutes.ts': '/api/messaging',
    'whatsapp.routes.ts': '/api/whatsapp',
    'webhooks.ts': '/webhooks'
}

def parse_route_file(filename, base_path):
    filepath = os.path.join(ROUTES_DIR, filename)
    if not os.path.exists(filepath):
        print(f"Warning: File not found: {filepath}")
        return []

    with open(filepath, 'r') as f:
        content = f.read()

    routes = []
    
    # Regex to find router methods
    # Matches: router.get('/path', ...
    # Also tries to capture JSDoc comments before the route
    
    # Split by lines to handle comments better
    lines = content.split('\n')
    
    current_comment = []
    
    for i, line in enumerate(lines):
        line = line.strip()
        
        # Capture comments
        if line.startswith('/**') or line.startswith('*') or line.startswith('//'):
            if line.startswith('/**'):
                current_comment = []
            
            clean_comment = line.replace('/**', '').replace('*/', '').replace('*', '').replace('//', '').strip()
            if clean_comment:
                current_comment.append(clean_comment)
            continue
            
        # Match route definition
        match = re.search(r'router\.(get|post|put|delete|patch)\s*\(\s*[\'"]([^\'"]*)[\'"]', line)
        if match:
            method = match.group(1).upper()
            path = match.group(2)
            
            # Construct full URL
            full_path = base_path + path
            # Remove trailing slash if not root
            if full_path.endswith('/') and len(full_path) > 1:
                full_path = full_path[:-1]
                
            # Extract description from comments
            description = ""
            name = f"{method} {path}"
            
            for comment in current_comment:
                if '@desc' in comment:
                    description = comment.replace('@desc', '').strip()
                    name = description
                elif '@route' not in comment and '@access' not in comment:
                     if not description:
                         description = comment
            
            if not description:
                description = f"{method} {full_path}"

            routes.append({
                'name': name,
                'method': method,
                'path': full_path,
                'description': description
            })
            
            # Reset comment
            current_comment = []
        elif line.strip() == '':
            pass # Keep comments if empty line
        else:
            # If line is code but not a route, reset comments unless it's a multi-line route
            if not line.startswith('router.'):
                 current_comment = []

    return routes

def generate_collection():
    collection = {
        "info": {
            "name": "WEXP Backend API",
            "description": "Auto-generated Postman collection for WEXP Backend",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "item": []
    }

    for filename, base_path in BASE_PATHS.items():
        print(f"Processing {filename}...")
        routes = parse_route_file(filename, base_path)
        
        if not routes:
            continue
            
        folder = {
            "name": base_path.replace('/api/', '').replace('/', '').capitalize(),
            "item": []
        }
        
        for route in routes:
            # Handle path variables for Postman (e.g., :id -> {{id}})
            # Actually Postman uses :id syntax too, but let's keep it as is or convert if needed.
            # Postman supports :variable syntax in the URL field.
            
            request_item = {
                "name": route['name'],
                "request": {
                    "method": route['method'],
                    "header": [
                        {
                            "key": "Content-Type",
                            "value": "application/json"
                        },
                        {
                            "key": "Authorization",
                            "value": "Bearer {{token}}"
                        }
                    ],
                    "url": {
                        "raw": "{{base_url}}" + route['path'],
                        "host": ["{{base_url}}"],
                        "path": [p for p in route['path'].split('/') if p]
                    },
                    "description": route['description']
                },
                "response": []
            }
            
            # Add body for POST/PUT
            if route['method'] in ['POST', 'PUT', 'PATCH']:
                request_item['request']['body'] = {
                    "mode": "raw",
                    "raw": "{\n    \n}"
                }
                
            folder['item'].append(request_item)
            
        collection['item'].append(folder)

    with open(OUTPUT_FILE, 'w') as f:
        json.dump(collection, f, indent=4)
    
    print(f"Collection generated at {OUTPUT_FILE}")

if __name__ == '__main__':
    generate_collection()

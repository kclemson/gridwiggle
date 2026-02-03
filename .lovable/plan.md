

# Smart Collage Creator

A mobile-friendly web app that makes creating beautiful, professional-looking photo collages effortless. Upload photos, let AI handle the cropping, and the app will intelligently arrange everything into a gap-free, evenly-spaced collage.

---

## Core User Flow

### 1. Photo Upload
- Large, easy-to-tap button to select photos from device gallery
- Support for selecting multiple photos at once (optimized for 2-8 photos)
- Can add more photos at any point in the process
- Photos displayed as thumbnails in a grid showing originals
- Remove any photo with an X button

### 2. Smart Auto-Cropping
- Each uploaded photo is automatically analyzed by AI (cloud-based) to detect faces, people, and central subjects
- Smart crop applied to focus on the important content
- "Smart cropped" versions displayed in a separate section below originals
- When a photo is removed, its smart crop is also removed

### 3. Manual Crop Adjustment
- Tap any smart-cropped thumbnail to fine-tune
- Opens a crop editor showing the original photo
- Crop handles default to the AI-suggested region
- User can drag handles to adjust the crop area
- Save or cancel the adjustment

### 4. Collage Settings (Simple)
- **Orientation preference**: Portrait (taller) or Landscape (wider)
  - The algorithm will find the optimal exact ratio within that preference
  - 1:1 square is valid for either choice
- **Gap color**: Color picker to choose background/spacing color
- **Spacing amount**: Simple slider for gap size between photos

### 5. Collage Generation
- Tap "Create Collage" button
- Algorithm calculates optimal layout:
  - Even spacing between all photos
  - No empty background gaps or awkward holes
  - Dynamically adjusts collage dimensions to fit perfectly
  - Handles mixed portrait/landscape photos seamlessly

### 6. Collage Editing
- View the generated collage
- **Drag & drop** to rearrange photos (touch-friendly on mobile)
- When moving a photo to a slot with different dimensions, prompted to adjust crop
- Real-time preview of changes

### 7. Export
- Download as PNG
- High resolution for social media and sharing

---

## Design Style
- **Modern dark mode** aesthetic
- Dark backgrounds make photos pop
- Clean, minimal interface
- Touch-optimized for mobile with larger tap targets
- Fully responsive for desktop use too

---

## Data Handling
- All work-in-progress saved to local storage
- User can close browser and return without losing photos or crops
- Final output exported as PNG to user's device

---

## Technical Approach
- Cloud-based AI for smart cropping (using vision AI to detect subjects)
- Custom layout algorithm that prioritizes:
  1. No gaps or empty spaces
  2. Uniform spacing
  3. Respecting the orientation preference
- Works seamlessly with any mix of portrait and landscape photos


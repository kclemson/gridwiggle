

## Smart Crop: People Priority

Simplify the algorithm to focus on people when detected, otherwise use all detections.

---

## Logic

```text
calculateOptimalCrop(detections):

  1. Filter by confidence > 0.4 (unchanged)
  
  2. Find people:
     peopleDetections = detections where label === 'person'
  
  3. Choose which set defines the crop:
     - If peopleDetections.length > 0 → use peopleDetections only
     - Else → use all detections (current behavior)
  
  4. Calculate bounding box (unchanged math)
```

---

## Your Photo Example

```text
Detected:
  - person (child 1) → label === 'person' ✓
  - person (child 2) → label === 'person' ✓
  - person (child 3) → label === 'person' ✓
  - potted plant     → not a person, ignored
  - bench            → not a person, ignored

Result: Crop focuses on the 3 children
```

---

## Other Scenarios

| Photo Type | People Detected? | Behavior |
|------------|------------------|----------|
| Family with dog | Yes | Focus on people (dog likely in frame anyway) |
| Just a dog | No | Fallback: all detections → dog included |
| Landscape | No | Fallback: all detections → current behavior |
| Group selfie | Yes | Focus on people |

---

## File Changes

| File | Change |
|------|--------|
| `src/workers/visionWorker.ts` | Update `calculateOptimalCrop` to filter for `'person'` label before bounding box calculation |

---

## Code Change

In `calculateOptimalCrop`, after the confidence filter:

```typescript
// Current: uses all subjects with confidence > 0.4
const subjects = detections.filter(d => d.score > 0.4);

// New: prioritize people if detected
const allSubjects = detections.filter(d => d.score > 0.4);
const people = allSubjects.filter(d => d.label === 'person');
const subjects = people.length > 0 ? people : allSubjects;
```

Three lines. No config objects. No category lists.


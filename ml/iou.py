
def calculate_iou(box_a, box_b):
    """
    Calculate Intersection over Union (IoU).

    Box format: [x1, y1, x2, y2]
    """

    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b

    # Validate bounding boxes
    if ax2 <= ax1 or ay2 <= ay1:
        raise ValueError("Invalid box A coordinates")

    if bx2 <= bx1 or by2 <= by1:
        raise ValueError("Invalid box B coordinates")

    # Step 1: Calculate intersection boundaries
    x_left = max(ax1, bx1)
    y_top = max(ay1, by1)

    x_right = min(ax2, bx2)
    y_bottom = min(ay2, by2)

    # Step 2: Calculate intersection dimensions
    intersection_width = max(0, x_right - x_left)
    intersection_height = max(0, y_bottom - y_top)

    # Step 3: Calculate intersection area
    intersection_area = intersection_width * intersection_height

    # Step 4: Calculate individual box areas
    area_a = (ax2 - ax1) * (ay2 - ay1)
    area_b = (bx2 - bx1) * (by2 - by1)

    # Step 5: Calculate union area
    union_area = area_a + area_b - intersection_area

    # Step 6: Calculate IoU
    if union_area == 0:
        return 0.0

    return intersection_area / union_area

# Test cases
if __name__ == "__main__":
    box_a = [0, 0, 100, 100]

    test_cases = [
        [50, 0, 150, 100],
        [200, 200, 300, 300],
        [0, 0, 100, 100]
    ]

    for box_b in test_cases:
        iou = calculate_iou(box_a, box_b)
        print(f"IoU: {iou:.4f}")

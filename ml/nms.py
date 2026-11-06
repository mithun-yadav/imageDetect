
from iou import calculate_iou


def non_max_suppression(boxes, scores, iou_threshold=0.5):

    # Step 1: Sort box indices by confidence (highest first)
    sorted_indices = sorted(
        range(len(scores)),
        key=lambda i: scores[i],
        reverse=True
    )

    # Store indices of boxes we want to retain
    keep = []

    # Step 2: Process boxes until none remain
    while sorted_indices:

        # Select highest-confidence box
        current_index = sorted_indices.pop(0)

        # Keep this box
        keep.append(current_index)

        remaining_indices = []

        # Step 3: Compare selected box with remaining boxes
        for index in sorted_indices:

            iou = calculate_iou(
                boxes[current_index],
                boxes[index]
            )

            # Suppress overlapping boxes
            if iou <= iou_threshold:
                remaining_indices.append(index)

        # Continue with unsuppressed boxes
        sorted_indices = remaining_indices

    return keep


# Test data
boxes = [
    [0, 0, 100, 100],
    [10, 10, 110, 110],
    [200, 200, 300, 300]
]

scores = [0.95, 0.85, 0.70]

selected_indices = non_max_suppression(
    boxes,
    scores,
    iou_threshold=0.5
)

print("Selected indices:", selected_indices)

for index in selected_indices:
    print(
        f"Box: {boxes[index]}, "
        f"Confidence: {scores[index]}"
    )

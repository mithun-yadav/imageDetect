
from iou import calculate_iou


def non_max_suppression(
    boxes,
    scores,
    classes,
    iou_threshold=0.5
):
    sorted_indices = sorted(
        range(len(scores)),
        key=lambda i: scores[i],
        reverse=True
    )

    keep = []

    while sorted_indices:
        current_index = sorted_indices.pop(0)
        keep.append(current_index)

        remaining_indices = []

        for index in sorted_indices:

            # Different classes: never suppress each other
            if classes[current_index] != classes[index]:
                remaining_indices.append(index)
                continue

            # Same class: compare IoU
            iou = calculate_iou(
                boxes[current_index],
                boxes[index]
            )

            if iou <= iou_threshold:
                remaining_indices.append(index)

        sorted_indices = remaining_indices

    return keep


if __name__ == "__main__":
    boxes = [
        [0, 0, 100, 100],
        [10, 10, 110, 110],
        [20, 20, 120, 120],
        [200, 200, 300, 300]
    ]

    scores = [0.95, 0.85, 0.80, 0.70]

    classes = [
        "person",
        "person",
        "bicycle",
        "car"
    ]

    selected = non_max_suppression(
        boxes,
        scores,
        classes,
        iou_threshold=0.5
    )

    print("Selected indices:", selected)

    for index in selected:
        print(
            f"Box: {index}, "
            f"Class: {classes[index]}, "
            f"Confidence: {scores[index]}"
        )

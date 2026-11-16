
"""
Documented exclusions for problematic source annotations.

These exclusions apply to original COCO annotation IDs,
not image IDs or entire image files.
"""

EXCLUDED_ANNOTATIONS = {
    18863: {
        "image_id": 16950,
        "category_id": 18,
        "reason": (
            "One annotation groups 17 disconnected dog polygons "
            "into a single oversized bounding box covering almost "
            "the entire image. Individual dog annotations exist."
        ),
    },
}

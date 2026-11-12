Precision	How many predictions are correct?
Recall	How many actual objects were detected?
F1 Score	Balance between precision and recall
AP	Overall precision-recall performance for one object class
mAP	Average AP across multiple object classes


Here is the formula: 

```

    Mean Average Precision is the average of these AP values:
\[
mAP = \frac{AP_{person}+AP_{car}+AP_{bicycle}}{3}
\]

```

```\[
mAP = \frac{\text{Sum of all AP values}}{\text{Number of classes}}
\]```
import { useEffect, useState } from "react";
import { Alert, Button, Col, Form, Modal, Row, Spinner } from "react-bootstrap";
import { closeModal } from "../../utils/modalUtil";
import { monthsBetween } from "./periods";
import type { ReportPeriod } from "./types";

const MONTH_OPTIONS = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
];

interface GenerateReportsModalContentProps {
    maxMonth: string;
    onGenerate: (months: ReportPeriod[]) => Promise<boolean>;
}

export default function GenerateReportsModalContent({
    maxMonth,
    onGenerate,
}: GenerateReportsModalContentProps) {
    const [maxYear, maxMonthNumber] = maxMonth.split("-").map(Number);
    const [fromYearValue, setFromYearValue] = useState("");
    const [fromMonthValue, setFromMonthValue] = useState("");
    const [toYearValue, setToYearValue] = useState("");
    const [toMonthValue, setToMonthValue] = useState("");
    const [rangeError, setRangeError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fromYearNumber = Number(fromYearValue);
    const fromMonthNumber = Number(fromMonthValue);
    const toYearNumber = Number(toYearValue);
    const toMonthNumber = Number(toMonthValue);

    useEffect(() => {
        let nextFromMonthValue = fromMonthValue;
        let nextToYearValue = toYearValue;
        let nextToMonthValue = toMonthValue;

        if (fromYearValue && toYearValue && toYearNumber < fromYearNumber) {
            nextToYearValue = fromYearValue;
        }

        if (
            fromYearValue &&
            fromMonthValue &&
            fromYearNumber === maxYear &&
            fromMonthNumber > maxMonthNumber
        ) {
            nextFromMonthValue = String(maxMonthNumber);
        }

        const nextToYearNumber = Number(nextToYearValue);
        if (
            nextToYearValue &&
            nextToMonthValue &&
            nextToYearNumber === maxYear &&
            Number(nextToMonthValue) > maxMonthNumber
        ) {
            nextToMonthValue = String(maxMonthNumber);
        }

        if (
            fromYearValue &&
            nextToYearValue &&
            nextFromMonthValue &&
            nextToMonthValue &&
            fromYearNumber === nextToYearNumber &&
            Number(nextToMonthValue) < Number(nextFromMonthValue)
        ) {
            nextToMonthValue = nextFromMonthValue;
        }

        if (nextFromMonthValue !== fromMonthValue) {
            setFromMonthValue(nextFromMonthValue);
        }
        if (nextToYearValue !== toYearValue) {
            setToYearValue(nextToYearValue);
        }
        if (nextToMonthValue !== toMonthValue) {
            setToMonthValue(nextToMonthValue);
        }
    }, [
        fromMonthNumber,
        fromMonthValue,
        fromYearNumber,
        fromYearValue,
        maxMonthNumber,
        maxYear,
        toMonthNumber,
        toMonthValue,
        toYearNumber,
        toYearValue,
    ]);

    const selectedRange = (() => {
        if (
            !fromYearValue ||
            !fromMonthValue ||
            !toYearValue ||
            !toMonthValue ||
            !Number.isInteger(fromYearNumber) ||
            !Number.isInteger(fromMonthNumber) ||
            !Number.isInteger(toYearNumber) ||
            !Number.isInteger(toMonthNumber)
        ) {
            return null;
        }

        return {
            fromYear: fromYearNumber,
            fromMonth: fromMonthNumber,
            toYear: toYearNumber,
            toMonth: toMonthNumber,
        };
    })();

    const isUnavailableFromMonth = (month: number) =>
        fromYearNumber === maxYear && month > maxMonthNumber;

    const isUnavailableToMonth = (month: number) =>
        (toYearNumber === maxYear && month > maxMonthNumber) ||
        (fromYearValue !== "" &&
            toYearValue !== "" &&
            fromMonthValue !== "" &&
            fromYearNumber === toYearNumber &&
            month < fromMonthNumber);

    const rangeCount = (() => {
        if (!selectedRange) return 0;
        const { fromYear, fromMonth, toYear, toMonth } = selectedRange;
        return fromYear > toYear || (fromYear === toYear && fromMonth > toMonth)
            ? 0
            : monthsBetween(fromYear, fromMonth, toYear, toMonth).length;
    })();

    const handleGenerate = async () => {
        setRangeError(null);
        if (!selectedRange) {
            setRangeError("Please select both From and To month/year values.");
            return;
        }

        const { fromYear, fromMonth, toYear, toMonth } = selectedRange;
        if (fromYear > toYear || (fromYear === toYear && fromMonth > toMonth)) {
            setRangeError('"From" must not be after "To".');
            return;
        }
        if (
            toYear > maxYear ||
            (toYear === maxYear && toMonth > maxMonthNumber)
        ) {
            setRangeError(
                "Cannot generate reports for the current or future month."
            );
            return;
        }

        setIsSubmitting(true);
        try {
            const didGenerate = await onGenerate(
                monthsBetween(fromYear, fromMonth, toYear, toMonth)
            );
            if (didGenerate) closeModal();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Modal.Header closeButton>
                <Modal.Title>Generate Reports</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {rangeError && <Alert variant="danger">{rangeError}</Alert>}
                <Row className="mb-3">
                    <Col>
                        <Form.Label>From</Form.Label>
                        <Row className="g-2">
                            <Col>
                                <Form.Select
                                    aria-label="From month"
                                    value={fromMonthValue}
                                    onChange={(e) =>
                                        setFromMonthValue(e.target.value)
                                    }
                                >
                                    <option value="">Month</option>
                                    {MONTH_OPTIONS.map((month) => (
                                        <option
                                            key={month.value}
                                            value={month.value}
                                            disabled={isUnavailableFromMonth(
                                                month.value
                                            )}
                                        >
                                            {month.label}
                                        </option>
                                    ))}
                                </Form.Select>
                            </Col>
                            <Col>
                                <Form.Control
                                    aria-label="From year"
                                    type="number"
                                    inputMode="numeric"
                                    min={1900}
                                    max={maxYear}
                                    placeholder="Year"
                                    value={fromYearValue}
                                    onChange={(e) =>
                                        setFromYearValue(e.target.value)
                                    }
                                />
                            </Col>
                        </Row>
                    </Col>
                    <Col>
                        <Form.Label>To</Form.Label>
                        <Row className="g-2">
                            <Col>
                                <Form.Select
                                    aria-label="To month"
                                    value={toMonthValue}
                                    onChange={(e) =>
                                        setToMonthValue(e.target.value)
                                    }
                                >
                                    <option value="">Month</option>
                                    {MONTH_OPTIONS.map((month) => (
                                        <option
                                            key={month.value}
                                            value={month.value}
                                            disabled={isUnavailableToMonth(
                                                month.value
                                            )}
                                        >
                                            {month.label}
                                        </option>
                                    ))}
                                </Form.Select>
                            </Col>
                            <Col>
                                <Form.Control
                                    aria-label="To year"
                                    type="number"
                                    inputMode="numeric"
                                    min={fromYearValue || 1900}
                                    max={maxYear}
                                    placeholder="Year"
                                    value={toYearValue}
                                    onChange={(e) =>
                                        setToYearValue(e.target.value)
                                    }
                                />
                            </Col>
                        </Row>
                    </Col>
                </Row>
                {rangeCount > 0 && (
                    <p className="text-muted mb-0">
                        This will generate {rangeCount} report
                        {rangeCount > 1 ? "s" : ""}.
                    </p>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button
                    variant="secondary"
                    onClick={closeModal}
                    disabled={isSubmitting}
                >
                    Cancel
                </Button>
                <Button
                    variant="primary"
                    onClick={() => void handleGenerate()}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <>
                            <Spinner
                                animation="border"
                                size="sm"
                                className="me-1"
                            />
                            Generating...
                        </>
                    ) : (
                        "Generate"
                    )}
                </Button>
            </Modal.Footer>
        </>
    );
}

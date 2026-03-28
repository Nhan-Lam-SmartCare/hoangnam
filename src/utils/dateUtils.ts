export const getDateRange = (filter: string): { startDate: Date; endDate: Date; label: string } => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let label = "";

    // Handle specific month filters (month1, month2, ... month12)
    if (filter.startsWith("month") && filter.length > 5) {
        const monthNum = parseInt(filter.slice(5), 10);
        if (monthNum >= 1 && monthNum <= 12) {
            startDate = new Date(now.getFullYear(), monthNum - 1, 1);
            endDate = new Date(now.getFullYear(), monthNum, 0, 23, 59, 59);
            label = `Tháng ${monthNum}`;
        } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            label = "Tháng này";
        }
    }
    // Handle quarter filters (q1, q2, q3, q4)
    else if (filter.startsWith("q") && filter.length === 2) {
        const quarterNum = parseInt(filter.slice(1), 10);
        if (quarterNum >= 1 && quarterNum <= 4) {
            const startMonth = (quarterNum - 1) * 3;
            startDate = new Date(now.getFullYear(), startMonth, 1);
            endDate = new Date(now.getFullYear(), startMonth + 3, 0, 23, 59, 59);
            label = `Quý ${quarterNum}`;
        } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            label = "Tháng này";
        }
    }
    // Handle standard filters
    else {
        switch (filter) {
            case "today":
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                label = "Hôm nay";
                break;
            case "7days":
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                label = "7 ngày qua";
                break;
            case "week":
                const dayOfWeek = now.getDay();
                const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
                label = "Tuần này";
                break;
            case "month":
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                label = "Tháng này";
                break;
            case "year":
                startDate = new Date(now.getFullYear(), 0, 1);
                label = `Năm ${now.getFullYear()}`;
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                label = "Tháng này";
        }
    }

    return { startDate, endDate, label };
};

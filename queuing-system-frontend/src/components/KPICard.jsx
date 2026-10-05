import { Card, CardContent, Typography, Box } from "@mui/material";

function KPICard({
    title,
    value,
    subtitle,
    color = "#1976d2"
}) {

    return (

        <Card
            elevation={4}
            sx={{
                borderRadius: 3,
                height: "100%",
                border: "1px solid #dbeafe",
                background: "linear-gradient(135deg, #ffffff 0%, #f5f9ff 100%)",
                boxShadow: "0 12px 28px rgba(7, 27, 73, 0.08)",
            }}
        >

            <CardContent>

                <Typography
                    variant="body2"
                    sx={{ color: "#334155", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}
                >
                    {title}
                </Typography>

                <Typography
                    variant="h4"
                    fontWeight="bold"
                    sx={{
                        color: color,
                        mt: 1,
                        textShadow: "0 1px 0 rgba(255,255,255,0.45)"
                    }}
                >
                    {value}
                </Typography>

                <Box sx={{ mt: 1 }}>

                    <Typography
                        variant="body2"
                        sx={{ color: "#0f172a", fontWeight: 600 }}
                    >
                        {subtitle}
                    </Typography>

                </Box>

            </CardContent>

        </Card>

    );

}

export default KPICard;
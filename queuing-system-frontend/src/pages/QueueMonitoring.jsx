import { Box, Typography } from "@mui/material";

function QueueMonitoring() {

    return (

        <Box>

            <Typography
                variant="h4"
                fontWeight="bold"
            >
                Queue Monitoring
            </Typography>

            <Typography
                color="text.secondary"
                sx={{ mt:1 }}
            >
                Monitor Cashier and Registrar queues in real time.
            </Typography>

        </Box>

    )

}

export default QueueMonitoring;
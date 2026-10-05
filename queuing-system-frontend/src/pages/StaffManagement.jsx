import { Box, Typography } from "@mui/material";

function StaffManagement(){

    return(

        <Box>

            <Typography
                variant="h4"
                fontWeight="bold"
            >
                Staff Management
            </Typography>

            <Typography
                color="text.secondary"
                sx={{ mt:1 }}
            >
                Manage employees and permissions.
            </Typography>

        </Box>

    )

}

export default StaffManagement;
import { Box, Typography } from "@mui/material";

function DisplaySettings(){

    return(

        <Box>

            <Typography
                variant="h4"
                fontWeight="bold"
            >
                Display Board Settings
            </Typography>

            <Typography
                color="text.secondary"
                sx={{ mt:1 }}
            >
                Customize the Queue Display Board.
            </Typography>

        </Box>

    )

}

export default DisplaySettings;
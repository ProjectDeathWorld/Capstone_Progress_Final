import { Box, Container } from "@mui/material";

function AdminLayout({ children }) {

    return (

        <Box
            sx={{
                minHeight: "100vh",
                background: "linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%)",
                py: 4,
                color: "#071b4d"
            }}
        >

            <Container
                maxWidth="xl"
            >

                {children}

            </Container>

        </Box>

    );

}

export default AdminLayout;
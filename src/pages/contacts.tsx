import Navbar from "../components/ui/Navbar";
import { Container, Stack } from "react-bootstrap";
import ContactsCard from "../components/ui/ContactsCard";

const contacts: React.FC = () => {
    const teamMembers = [
        { name: "Yarkin Eren", email: "yarkin.eren@helmholtz-munich.de" },
        { name: "Francesco Campi", email: "francesco.campi@helmholtz-munich.de" },
        { name: "Lisa Barros", email: "lisa.barros@helmholtz-munich.de" },
        { name: "Jonas Hagenberg", email: "jonas.hagenberg@helmholtz-munich.de" },
    ];

    return (
        <>
            <Navbar />

            <Container>
                <h1>Our Team</h1>

                <Stack direction="horizontal" className="flex-wrap align-items-start gap-3">
                    {teamMembers.map((member) => (
                        <ContactsCard name={member.name} email={member.email} />
                    ))}
                </Stack>
            </Container>
        </>
    );
};

export default contacts;

import Navbar from "../components/ui/Sidebar";
import { Col, Container, Row } from "react-bootstrap";
import ContactsCard from "../components/ui/ContactsCard";
import Header from "../components/ui/Header";
import Page from "../components/ui/Page";

const contact: React.FC = () => {
    const teamMembers = [
        { name: "Yarkin Eren", email: "yarkin.eren@helmholtz-munich.de" },
        {
            name: "Francesco Campi",
            email: "francesco.campi@helmholtz-munich.de",
        },
        { name: "Lisa Barros", email: "lisa.barros@helmholtz-munich.de" },
        {
            name: "Jonas Hagenberg",
            email: "jonas.hagenberg@helmholtz-munich.de",
        },
    ];

    return (
        <>
            <Header>
                <Header.Title>Our Team</Header.Title>
            </Header>

            <Page>
                <Row>
                    {teamMembers.map((member) => (
                        <Col md={3} key={member.email}>
                            <ContactsCard
                                name={member.name}
                                email={member.email}
                            />
                        </Col>
                    ))}
                </Row>
            </Page>
        </>
    );
};

export default contact;

import { Col } from "react-bootstrap";
import ContactsCard from "../components/ui/ContactsCard";
import Page from "../components/ui/Page";
import { Grid } from "../components/ui/Grid";

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
        <Page title="Our Team">
            <Grid gap="md" itemWidth="250px">
                {teamMembers.map((member) => (
                    <ContactsCard name={member.name} email={member.email} key={member.email} />
                ))}
            </Grid>
        </Page>
    );
};

export default contact;

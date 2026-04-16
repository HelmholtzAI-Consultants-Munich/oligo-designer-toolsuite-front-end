import ContactsCard from "../components/ui/ContactsCard";
import Page from "../components/ui/Page";
import { Grid } from "../components/ui/Alignment";
import { Alert } from "react-bootstrap";

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
        {
            name: "Simon Ament",
            email: "simon.ament@student.hpi.uni-potsdam.de",
        },
        {
            name: "Felix Dille",
            email: "felix.dille@student.hpi.uni-potsdam.de",
        },
        {
            name: "Louisa Mölm",
            email: "louisa.moelm@student.hpi.uni-potsdam.de",
        },
        {
            name: "Erin Sommer",
            email: "erin.sommer@student.hpi.uni-potsdam.de",
        },
        {
            name: "Max Timmermann",
            email: "max.timmermann@student.hpi.uni-potsdam.de",
        },
    ];

    return (
        <Page title="Our Team">
            <Grid gap="md" itemWidth="250px">
                {teamMembers.map((member, index) => (
                    <ContactsCard
                        name={member.name}
                        email={member.email}
                        key={member.email}
                        highlight={index === 0} // Highlight the first team member
                    />
                ))}
            </Grid>

            <Alert>
                We would love to hear from you. Contact us by email or use the
                Feedback button available on every page after logging in.
            </Alert>
        </Page>
    );
};

export default contact;

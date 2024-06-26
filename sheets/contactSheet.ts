
import { Flatfile } from "@flatfile/api";

export const contactSheet: Flatfile.SheetConfig = {
  slug: "contacts",
  name: "Contacts",
  mappingConfidenceThreshold: .6,
  allowAdditionalFields: true,
  access: [
    "add", //remove this to prevent manually adding data
    "edit",
    "import",
    "delete"
  ],
  fields: [
    {
      key: "firstName",
      type: "string",
      label: "First Name",
      constraints: [{ "type": "required" }]
    },
    {
      key: "lastName",
      type: "string",
      label: "Last Name"
    },
    {
      key: "fullName",
      type: "string",
      label: "Full Name",
      description: 'If not provided, the system will generate this from First & Last name.',
    },
    {
      key: "email",
      type: "string",
      label: "Email",
      description: 'Please enter your email',
      constraints: [{ "type": "unique" }]
    },
    {
      key: "phone",
      type: "string",
      label: "Phone Number",
    },
    {
      key: "date",
      type: "string",
      label: "Date",
    },
    // {
    //   key: "state",
    //   type: "enum",
    //   label: "State",
    //   config: {
    //     options: stateList
    //   }
    // },
    {
      key: "country",
      type: "string",
      label: "Country"
    },
    {
      key: "zipCode",
      type: "string",
      label: "Zip Code",
    },
    // {
    //   key: "numberTest",
    //   label: "Number",
    //   type: "number",
    //   constraints: [{ "type": "required" }]
    // },
    {
      key: "subscriber",
      label: "Subscriber?",
      type: "boolean",
    },
    {
      key: "status",
      label: "Deal Status",
      type: "enum",
      config: {
        options: [
          { value: "red", label: "New" },
          { value: "2", label: "Interested" },
          { value: "meet", label: "Meeting" },
          { value: "4", label: "Opportunity" },
          { value: "5", label: "Not a fit" }
        ]
      },
      constraints: [{ "type": "required" }]
    },
  ],
};


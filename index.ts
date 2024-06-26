import api, { Flatfile } from "@flatfile/api";
import {
  FlatfileListener, FlatfileEvent, Client,
} from "@flatfile/listener";
import { FlatfileRecord, bulkRecordHook } from "@flatfile/plugin-record-hook";
import { contactSheet } from "./sheets/contactSheet";
import { format, isDate, isFuture, parseISO } from "date-fns";
import { xlsxExtractorPlugin } from '@flatfile/plugin-xlsx-extractor'
import { jobHandler } from "@flatfile/plugin-job-handler";
import { PhoneNumberFormat, PhoneNumberUtil, PhoneNumber } from "google-libphonenumber"

const phoneUtil = PhoneNumberUtil.getInstance()

// function for validating, formatting phone numbers
function checkPhone(phone: string, countryCode: string = "US"): string | null {
  try {
    // use a country parameter to apply country rules to validation/formatting
    const parsePhone: PhoneNumber = phoneUtil.parse(phone, countryCode);
    if (phoneUtil.isValidNumber(parsePhone)) {
      // format the validated phone number per the country's rules
      return phoneUtil.format(parsePhone, PhoneNumberFormat.NATIONAL);
    }
    throw new Error('Invalid phone number');
  } catch (error) {
    return null; // Use null to indicate failure instead of a string
  }
}

export default function (listener: Client) {
  listener.on("**", (event) => {
    console.log(`Received event:, ${JSON.stringify(event.context, null, 2)} ${JSON.stringify(event.payload, null, 2)}`);
  });

  listener
    .filter({ job: "space:configure" })
    .on("job:ready", async (event: FlatfileEvent) => {
      const { spaceId, environmentId, jobId } = event.context;
      try {
        await api.jobs.ack(jobId, {
          info: "Getting started.",
          progress: 10,
        });

        await api.workbooks.create({
          spaceId,
          environmentId,
          name: "Import Data",
          labels: ["pinned"], // makes this workbook the first one in the list
          settings: { trackChanges: true },
          sheets: [contactSheet],
          actions: [
            {
              label: "Submit",
              operation: "submit",
              description: "Ready to submit your data?",
              mode: "foreground",
              primary: true,
              confirm: true,
              constraints: [{ type: 'hasData' }]
            }
          ]
        })

        const doc = await api.documents.create(spaceId, {
          title: "Getting Started",
          body:
            "# Welcome\n" +
            "### Say hello to your first customer Space in the new Flatfile!\n" +
            "Let's begin by first getting acquainted with what you're seeing in your Space initially.\n" +
            "---\n" +
            "[Im an inline-style link](https://platform.flatfile.com/s/space/us_sp_dM00CQQt/workbook/us_wb_MP6zpC8K/sheet/us_sh_yUQ9uoFJ)",
        });

        const ephemeralDoc = await api.documents.create(spaceId, {
          title: 'Howdy',
          body: '# Welcome ...',
          treatments: ['ephemeral'],
          actions: [{
            operation: "gotoSheet",
            mode: Flatfile.ActionMode.Foreground,
            label: "Go to Contacts Sheet",
            primary: false
          }],
        })

        const ephemDocId = ephemeralDoc.data.id
        const metadata = {
          ephemDocId,
          sidebarConfig: {
            // defaultPage: {
            // documentId: doc.data.id
            // },
            showPoweredBy: true,
            showGuestInvite: false,
            showDataChecklist: true,
            showSidebar: true,
          }
        }

        await api.spaces.update(spaceId, {
          environmentId,
          metadata: metadata,
        });

        await api.jobs.complete(jobId, {
          outcome: {
            acknowledge: true,
            heading: "Success!",
            message: "Your Space was created. Let's get started.",
            hideDefaultButton: true,
            next: {
              type: "id",
              id: ephemDocId,
              label: "Get Started",
            },
          },
        });

      } catch (error) {
        console.error("Error:", error.stack);
        await api.jobs.fail(jobId, {
          outcome: {
            message: "Creating a Space encountered an error. See Event Logs.",
            acknowledge: true,
          },
        });
      }
    });

  // seed the cost center sheet with data
  listener.on('workbook:created', async (event) => {
    const workbookId = event.context.workbookId;
    const spaceId = event.context.spaceId
    const environmentId = event.context.environmentId

    // Demo pulling data from front end metadata and inserting into sheet
    const space = await api.spaces.get(spaceId)
    const meta = space.data.metadata.spaceInfo.metadata.data
    console.log(`Meta: ${JSON.stringify(meta, null, 2)}`)

    let workbook;
    try {
      workbook = await api.workbooks.get(workbookId);
    } catch (error) {
      console.error('Error getting workbook:', error.message);
      return;
    }
    const sheets =
      workbook.data && workbook.data.sheets ? workbook.data.sheets : [];
    const contactSheet = sheets.find((s) =>
      s.config.slug.includes('contacts')
    )

    const guest = await api.guests.create([{
      environmentId: environmentId,
      email: "roby+test@flatfile.io",
      name: "Roby Guest",
      spaces: [{
        id: spaceId,
        workbooks: [{
          id: workbookId
        }]
      }]
    }])

    await api.guests.invite([{
      guestId: guest.data[0].id,
      spaceId: spaceId,
      fromName: "Roby",
      message: "Hello, I would like to invite you to my space."
    }])
  })

  listener.on(
    "job:ready",
    { job: "document:gotoSheet" },
    async (event: FlatfileEvent) => {
      const { spaceId, jobId } = event.context;
      // console.log(`Ephem Event: ${JSON.stringify(event, null, 2)}`)

      const space = await api.spaces.get(spaceId);
      const workbook = await api.workbooks.list({ spaceId: space.data.id })
      const sheetId = workbook.data[0].sheets[0].id
      console.log(`wbid: ${JSON.stringify(sheetId, null, 2)}`)

      await api.jobs.complete(jobId, {
        outcome: {
          acknowledge: true,
          heading: "Let's go to the sheet!",
          message: "Go to the Contact Sheet",
          hideDefaultButton: true,
          next: {
            type: "id",
            id: sheetId,
            label: "Contact Sheet"
          },
        },
      });
    }
  )

  listener.use(
    bulkRecordHook("contacts", async (records: FlatfileRecord[], event) => {

      // get metadata from space
      const { spaceId, environmentId, jobId } = event.context;
      const space = await api.spaces.get(spaceId)
      const meta = space.data.metadata
      console.log(`Meta: ${JSON.stringify(meta, null, 2)}`)

      // make external api calls outside of map function

      // Normal recordHooks go in the map function
      records.map((record) => {

        if (record.get('email')) {
          const email = record.get("email") as string;
          const validEmailAddress = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;
          if (!validEmailAddress.test(email)) {
            record.addError("email", "Must be a valid email address");
          }
        }

        // validate, format phone numbers
        if (record.get('phone') && record.get('country')) {
          const country = record.get('country') as string
          const phone = checkPhone(record.get('phone') as string, country);
          if (phone) {
            record.set('phone', phone);
          } else {
            record.addWarning('phone', "Invalid phone number");
          }
        };

        if (record.get('country')) {
          const country = record.get("country") as string;
          const validCountry = /^[A-Z]{2}$/;
          if (!validCountry.test(country)) {
            // console.log("Invalid country");
            record.addError("country", "Must be two char country code");
          }
        }

        if (record.get('firstName') && !record.get('lastName')) {
          const fName = record.get('firstName') as string;
          if (fName.includes(" ")) {
            const components = fName.split(" ");
            record.set('firstName', components.shift());
            record.set('lastName', components.join(" "));
            record.addInfo('lastName', 'Automatically generated from full name')
          }
        }

        if (record.get('firstName') && record.get('lastName') && !record.get('fullName')) {
          const fullName = `${record.get('firstName')} ${record.get('lastName')}`
          record.set('fullName', fullName)
          record.addInfo('fullName', 'System generated by combining first and last name.')
        }

        if (!record.get('phone') && !record.get('email')) {
          record.addWarning('phone', 'Please include one of either phone or email')
          record.addWarning('email', 'Please include one of either phone or email')
        }

        if (record.get('date')) {
          try {
            //reformat the date to ISO format
            const date = record.get('date') as string
            let thisDate = format(new Date(date), "yyyy-MM-dd");
            //create var that holds the date value of the reformatted date as
            //thisDate is only a string
            let realDate = parseISO(thisDate);
            if (isDate(realDate)) {
              record.set('date', thisDate)
              if (isFuture(realDate)) {
                record.addError('date', 'Date cannot be in the future.')
              }
            }
          } catch (e) {
            console.log(`Date error: ${e}`)
            record.addError('date', 'Please check that the date is formatted YYYY-MM-DD.')
          }
        }

        if (record.get('zipCode') && record.get('country')) {
          const zip = record.get('zipCode') as string
          const country = record.get('country') as string
          if (zip && zip.length < 5 && country === "US") {
            record.set('zipCode', zip.padStart(5, '0'))
            record.addInfo('zipCode', 'Zipcode was padded with zeroes')
          }
        }

        return record;

      })
    })
  );


  listener
    .filter({ job: "workbook:submit" })
    .on("job:ready", async (event: FlatfileEvent) => {
      console.log(`Event Context: ${JSON.stringify(event.context, null, 2)}`);
      const { workbookId, jobId, spaceId } = event.context;

      try {
        await api.jobs.ack(jobId, {
          info: "Getting started.",
          progress: 10,
        });

        // Get metadata from space
        const space = await api.spaces.get(spaceId);
        const meta = space.data.metadata || [];
        if (meta.length > 0) {
          console.log(`Meta: ${JSON.stringify(meta[0], null, 2)}`);
        }

        const dataArray = [];
        dataArray.push(meta[0] || {}); // Ensure there is always an object in the first position
        const { data: workbookSheets } = await api.sheets.list({ workbookId });
        const contactsSheet = workbookSheets.find(sheet => sheet.slug === 'contacts');

        console.log(`sheetID: ${contactsSheet.id}`);
        const { data: records } = await api.records.get(contactsSheet.id);
        dataArray.push({ id: contactsSheet.id, records: records.records || [] }); // Ensure records are always in an array

        await api.jobs.complete(jobId, {
          outcome: {
            message: "Your data has been submitted.",
            next: {
              type: "wait"
            }
          },
        });

      } catch (error) {
        await api.jobs.fail(jobId, {
          outcome: {
            message: `${error}`,
          },
        });
      }
    });

  listener.use(xlsxExtractorPlugin({ rawNumbers: true }))

}

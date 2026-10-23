// Describe Image: invented practice datasets drawn as charts in the app. APPEND ONLY.
// type: bar | line | pie | group (grouped bars with two series)
const T = [
{ type: 'bar', title: 'Average daily screen time by age group', unit: 'hours', labels: ['13–17', '18–24', '25–34', '35–44', '45–54', '55+'], values: [7.4, 6.9, 5.8, 4.9, 4.1, 3.2] },
{ type: 'line', title: 'Monthly sales of electric bikes in one city', unit: 'thousand bikes', labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], values: [12, 13, 18, 25, 33, 41, 44, 42, 34, 26, 17, 14] },
{ type: 'pie', title: 'How students travel to campus', unit: '%', labels: ['Bus', 'Car', 'Walking', 'Bicycle', 'Train'], values: [38, 22, 18, 12, 10] },
{ type: 'bar', title: 'Annual rainfall in five cities', unit: 'mm', labels: ['Vancouver', 'Toronto', 'Montreal', 'Calgary', 'Halifax'], values: [1189, 831, 1000, 419, 1452] },
{ type: 'pie', title: 'Household energy use by purpose', unit: '%', labels: ['Heating', 'Water heating', 'Appliances', 'Cooling', 'Lighting'], values: [52, 18, 14, 10, 6] },
{ type: 'line', title: 'Average house price in a city', unit: 'thousand dollars', labels: ['2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'], values: [520, 590, 610, 640, 700, 830, 860, 790, 810] },
{ type: 'group', title: 'Share of retail sales: online versus in-store', unit: '%', labels: ['2018', '2020', '2022', '2024'], series: [{ name: 'Online', values: [18, 31, 29, 35] }, { name: 'In-store', values: [82, 69, 71, 65] }] },
{ type: 'bar', title: 'Number of employees by department', unit: 'employees', labels: ['Engineering', 'Sales', 'Support', 'Marketing', 'Finance', 'HR'], values: [120, 85, 65, 40, 25, 15] },
{ type: 'line', title: 'Visitors to a national park by month', unit: 'thousand visitors', labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], values: [8, 9, 14, 22, 38, 61, 79, 75, 47, 28, 12, 10] },
{ type: 'pie', title: 'Sources of electricity in a province', unit: '%', labels: ['Hydro', 'Nuclear', 'Natural gas', 'Wind', 'Other', 'Solar'], values: [60, 15, 11, 8, 4, 2] },
{ type: 'bar', title: 'Coffee consumed per person each year', unit: 'kg', labels: ['Finland', 'Norway', 'Canada', 'Italy', 'Japan', 'India'], values: [12, 9.9, 6.5, 5.9, 3.6, 0.1] },
{ type: 'line', title: 'Unemployment rate in a country', unit: '%', labels: ['2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'], values: [6.9, 7.0, 6.3, 5.8, 5.7, 9.5, 7.5, 5.3, 5.4, 6.3] },
{ type: 'group', title: 'Weekly study hours by year of study', unit: 'hours', labels: ['Year 1', 'Year 2', 'Year 3', 'Year 4'], series: [{ name: 'Library', values: [6, 7, 9, 11] }, { name: 'Home', values: [10, 9, 8, 7] }] },
{ type: 'pie', title: 'Monthly household budget', unit: '%', labels: ['Housing', 'Other', 'Transport', 'Food', 'Savings', 'Entertainment'], values: [34, 17, 16, 15, 10, 8] },
{ type: 'bar', title: 'Smartphone ownership by age', unit: '%', labels: ['18–29', '30–49', '50–64', '65+'], values: [96, 95, 83, 61] },
{ type: 'line', title: 'Daily high temperature over one week', unit: '°C', labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], values: [12, 15, 18, 16, 11, 9, 13] },
{ type: 'bar', title: 'Share of waste recycled by material', unit: '%', labels: ['Paper', 'Metal', 'Glass', 'Food', 'Plastic'], values: [68, 34, 31, 19, 9] },
{ type: 'pie', title: 'Time spent on social media by app type', unit: '%', labels: ['Video', 'Messaging', 'Photo', 'News', 'Other'], values: [41, 23, 19, 9, 8] },
{ type: 'group', title: 'Enrolment by gender in four faculties', unit: '%', labels: ['Engineering', 'Arts', 'Science', 'Business'], series: [{ name: 'Women', values: [24, 63, 51, 47] }, { name: 'Men', values: [76, 37, 49, 53] }] },
{ type: 'line', title: 'International students in a country', unit: 'thousand students', labels: ['2014', '2016', '2018', '2020', '2022', '2024'], values: [300, 410, 570, 530, 800, 750] },
{ type: 'bar', title: 'Average one-way commute time by city', unit: 'minutes', labels: ['Toronto', 'Vancouver', 'Montreal', 'Ottawa', 'Calgary', 'Halifax'], values: [34, 31, 30, 27, 26, 22] },
{ type: 'pie', title: 'Main reason for working from home', unit: '%', labels: ['Saves time', 'Flexibility', 'Fewer distractions', 'Cost savings', 'Other'], values: [37, 28, 15, 12, 8] },
{ type: 'line', title: 'Price of a cup of coffee', unit: 'dollars', labels: ['2010', '2012', '2014', '2016', '2018', '2020', '2022', '2024'], values: [1.6, 1.7, 1.85, 2.0, 2.1, 2.3, 2.6, 2.9] },
{ type: 'group', title: 'Cars and bicycles sold each year', unit: 'thousand units', labels: ['2021', '2022', '2023', '2024'], series: [{ name: 'Cars', values: [1650, 1500, 1550, 1600] }, { name: 'Bicycles', values: [1100, 1200, 1050, 1000] }] },
];
export default T.map((d, i) => ({ id: 'i' + String(i + 1).padStart(3, '0'), text: d.title, ...d }));
